"""Поиск пользователей по юзернейму в приложении Гроза."""
import json
import os
import psycopg2


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Session-Id",
    }


def get_session_user(cur, session_id):
    if not session_id:
        return None
    cur.execute(
        "SELECT u.id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = %s AND s.user_id IS NOT NULL",
        (session_id,)
    )
    row = cur.fetchone()
    return row[0] if row else None


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors_headers(), "body": ""}

    params = event.get("queryStringParameters") or {}
    query = (params.get("q") or "").strip().lower()
    session_id = (event.get("headers") or {}).get("X-Session-Id")

    if not query:
        return {"statusCode": 400, "headers": cors_headers(), "body": json.dumps({"error": "Укажите параметр q"})}

    conn = get_conn()
    cur = conn.cursor()

    try:
        me_id = get_session_user(cur, session_id)

        cur.execute(
            """
            SELECT id, username, display_name, avatar_color
            FROM users
            WHERE username ILIKE %s OR display_name ILIKE %s
            LIMIT 20
            """,
            (f"%{query}%", f"%{query}%")
        )
        rows = cur.fetchall()

        users = [
            {
                "id": r[0],
                "username": r[1],
                "display_name": r[2],
                "avatar_color": r[3],
                "is_me": r[0] == me_id
            }
            for r in rows
        ]

        return {
            "statusCode": 200,
            "headers": cors_headers(),
            "body": json.dumps({"users": users})
        }

    finally:
        cur.close()
        conn.close()
