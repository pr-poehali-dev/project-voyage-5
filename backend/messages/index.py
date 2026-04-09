"""Отправка и получение сообщений между пользователями в приложении Гроза."""
import json
import os
import psycopg2


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def cors():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Session-Id",
    }


def ok(data):
    return {"statusCode": 200, "headers": cors(), "body": json.dumps(data)}


def err(code, msg):
    return {"statusCode": code, "headers": cors(), "body": json.dumps({"error": msg})}


def get_user_by_session(cur, session_id):
    if not session_id:
        return None
    cur.execute(
        "SELECT u.id, u.display_name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = %s",
        (session_id,)
    )
    row = cur.fetchone()
    return {"id": row[0], "display_name": row[1]} if row else None


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors(), "body": ""}

    method = event.get("httpMethod", "GET")
    session_id = (event.get("headers") or {}).get("X-Session-Id")
    params = event.get("queryStringParameters") or {}

    conn = get_conn()
    cur = conn.cursor()

    try:
        me = get_user_by_session(cur, session_id)
        if not me:
            return err(401, "Не авторизован")

        # GET — загрузить сообщения с конкретным пользователем
        if method == "GET":
            other_id = params.get("with")
            since_id = params.get("since_id", "0")

            if not other_id:
                return err(400, "Укажите параметр with")

            cur.execute(
                """
                SELECT m.id, m.sender_id, u.display_name, u.avatar_color, m.text,
                       to_char(m.created_at AT TIME ZONE 'UTC', 'HH24:MI') as time
                FROM messages m
                JOIN users u ON u.id = m.sender_id
                WHERE (
                    (m.sender_id = %s AND m.receiver_id = %s) OR
                    (m.sender_id = %s AND m.receiver_id = %s)
                ) AND m.id > %s
                ORDER BY m.created_at ASC
                LIMIT 100
                """,
                (me["id"], int(other_id), int(other_id), me["id"], int(since_id))
            )
            rows = cur.fetchall()
            messages = [
                {
                    "id": r[0],
                    "sender_id": r[1],
                    "from": r[2],
                    "avatar_color": r[3],
                    "text": r[4],
                    "time": r[5],
                    "self": r[1] == me["id"],
                }
                for r in rows
            ]
            return ok({"messages": messages})

        # POST — отправить сообщение
        if method == "POST":
            body = json.loads(event.get("body") or "{}")
            receiver_id = body.get("receiver_id")
            text = (body.get("text") or "").strip()

            if not receiver_id or not text:
                return err(400, "Укажите receiver_id и text")
            if len(text) > 2000:
                return err(400, "Сообщение слишком длинное")

            cur.execute(
                "INSERT INTO messages (sender_id, receiver_id, text) VALUES (%s, %s, %s) RETURNING id, to_char(created_at AT TIME ZONE 'UTC', 'HH24:MI')",
                (me["id"], int(receiver_id), text)
            )
            msg_id, time_str = cur.fetchone()
            conn.commit()

            return ok({
                "message": {
                    "id": msg_id,
                    "sender_id": me["id"],
                    "from": me["display_name"],
                    "text": text,
                    "time": time_str,
                    "self": True,
                }
            })

        return err(400, "Неизвестный метод")

    finally:
        cur.close()
        conn.close()
