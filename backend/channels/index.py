"""Каналы: создание, подписка, публикация постов, поиск в приложении Гроза."""
import json
import os
import psycopg2

COLORS = ["#5865f2", "#eb459e", "#57f287", "#fee75c", "#ed4245", "#00b0f4", "#ff7043", "#9b59b6"]


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def cors():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Session-Id",
    }


def ok(data):
    return {"statusCode": 200, "headers": cors(), "body": json.dumps(data, default=str)}


def err(code, msg):
    return {"statusCode": code, "headers": cors(), "body": json.dumps({"error": msg})}


def get_user(cur, session_id):
    if not session_id:
        return None
    cur.execute(
        "SELECT u.id, u.display_name, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = %s",
        (session_id,)
    )
    row = cur.fetchone()
    return {"id": row[0], "display_name": row[1], "username": row[2]} if row else None


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors(), "body": ""}

    method = event.get("httpMethod", "GET")
    body = json.loads(event.get("body") or "{}")
    params = event.get("queryStringParameters") or {}
    session_id = (event.get("headers") or {}).get("X-Session-Id")
    action = body.get("action") or params.get("action") or ""

    conn = get_conn()
    cur = conn.cursor()

    try:
        me = get_user(cur, session_id)

        # GET список каналов пользователя (на которые подписан + свои)
        if method == "GET" and action == "my":
            if not me:
                return err(401, "Не авторизован")
            cur.execute(
                """
                SELECT c.id, c.name, c.username, c.description, c.is_public,
                       c.avatar_color, c.subscribers_count, c.owner_id,
                       (c.owner_id = %s) as is_owner
                FROM channels c
                JOIN channel_subscriptions cs ON cs.channel_id = c.id
                WHERE cs.user_id = %s
                ORDER BY c.name
                """,
                (me["id"], me["id"])
            )
            rows = cur.fetchall()
            channels = [
                {"id": r[0], "name": r[1], "username": r[2], "description": r[3],
                 "is_public": r[4], "avatar_color": r[5], "subscribers_count": r[6],
                 "owner_id": r[7], "is_owner": r[8]}
                for r in rows
            ]
            return ok({"channels": channels})

        # GET поиск каналов
        if method == "GET" and action == "search":
            q = (params.get("q") or "").strip()
            if not q:
                return err(400, "Укажите q")
            cur.execute(
                """
                SELECT c.id, c.name, c.username, c.description, c.avatar_color,
                       c.subscribers_count, c.is_public,
                       (cs.user_id IS NOT NULL) as subscribed
                FROM channels c
                LEFT JOIN channel_subscriptions cs ON cs.channel_id = c.id AND cs.user_id = %s
                WHERE c.is_public = TRUE AND (c.name ILIKE %s OR c.username ILIKE %s)
                LIMIT 20
                """,
                (me["id"] if me else 0, f"%{q}%", f"%{q}%")
            )
            rows = cur.fetchall()
            channels = [
                {"id": r[0], "name": r[1], "username": r[2], "description": r[3],
                 "avatar_color": r[4], "subscribers_count": r[5], "is_public": r[6],
                 "subscribed": r[7]}
                for r in rows
            ]
            return ok({"channels": channels})

        # GET посты канала
        if method == "GET" and action == "posts":
            channel_id = params.get("channel_id")
            since_id = int(params.get("since_id") or 0)
            if not channel_id:
                return err(400, "Укажите channel_id")
            cur.execute(
                """
                SELECT p.id, p.text, u.display_name, u.avatar_color,
                       to_char(p.created_at AT TIME ZONE 'UTC', 'DD Mon HH24:MI') as ts
                FROM channel_posts p
                JOIN users u ON u.id = p.author_id
                WHERE p.channel_id = %s AND p.id > %s
                ORDER BY p.created_at ASC
                LIMIT 100
                """,
                (int(channel_id), since_id)
            )
            rows = cur.fetchall()
            posts = [{"id": r[0], "text": r[1], "author": r[2], "avatar_color": r[3], "time": r[4]} for r in rows]
            return ok({"posts": posts})

        # POST создать канал
        if method == "POST" and action == "create":
            if not me:
                return err(401, "Не авторизован")
            name = (body.get("name") or "").strip()
            username = (body.get("username") or "").strip().lower().replace("@", "")
            description = (body.get("description") or "").strip()
            is_public = body.get("is_public", True)

            if not name:
                return err(400, "Введите название канала")
            if len(name) > 64:
                return err(400, "Название слишком длинное")

            if username:
                if len(username) < 3:
                    return err(400, "Username канала: минимум 3 символа")
                if not username.replace("_", "").isalnum():
                    return err(400, "Username: только буквы, цифры и _")
                cur.execute("SELECT id FROM channels WHERE username = %s", (username,))
                if cur.fetchone():
                    return err(409, "Username уже занят")

            import random
            color = random.choice(COLORS)
            cur.execute(
                """INSERT INTO channels (owner_id, name, username, description, is_public, avatar_color, subscribers_count)
                   VALUES (%s, %s, %s, %s, %s, %s, 1) RETURNING id""",
                (me["id"], name, username or None, description, is_public, color)
            )
            channel_id = cur.fetchone()[0]
            # автоподписка владельца
            cur.execute(
                "INSERT INTO channel_subscriptions (channel_id, user_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                (channel_id, me["id"])
            )
            conn.commit()
            return ok({"channel": {"id": channel_id, "name": name, "username": username,
                                   "description": description, "avatar_color": color,
                                   "is_public": is_public, "subscribers_count": 1, "is_owner": True}})

        # POST подписаться / отписаться
        if method == "POST" and action == "subscribe":
            if not me:
                return err(401, "Не авторизован")
            channel_id = body.get("channel_id")
            subscribe = body.get("subscribe", True)
            if not channel_id:
                return err(400, "Укажите channel_id")

            if subscribe:
                cur.execute(
                    "INSERT INTO channel_subscriptions (channel_id, user_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                    (int(channel_id), me["id"])
                )
                cur.execute("UPDATE channels SET subscribers_count = subscribers_count + 1 WHERE id = %s AND NOT EXISTS (SELECT 1 FROM channel_subscriptions WHERE channel_id = %s AND user_id = %s)", (int(channel_id), int(channel_id), me["id"]))
            else:
                cur.execute(
                    "DELETE FROM channel_subscriptions WHERE channel_id = %s AND user_id = %s",
                    (int(channel_id), me["id"])
                )
                cur.execute("UPDATE channels SET subscribers_count = GREATEST(0, subscribers_count - 1) WHERE id = %s", (int(channel_id),))
            conn.commit()
            return ok({"ok": True})

        # POST опубликовать пост
        if method == "POST" and action == "post":
            if not me:
                return err(401, "Не авторизован")
            channel_id = body.get("channel_id")
            text = (body.get("text") or "").strip()
            if not channel_id or not text:
                return err(400, "Укажите channel_id и text")
            # только владелец может постить
            cur.execute("SELECT owner_id FROM channels WHERE id = %s", (int(channel_id),))
            row = cur.fetchone()
            if not row or row[0] != me["id"]:
                return err(403, "Только владелец может публиковать посты")

            cur.execute(
                "INSERT INTO channel_posts (channel_id, author_id, text) VALUES (%s, %s, %s) RETURNING id, to_char(created_at AT TIME ZONE 'UTC', 'DD Mon HH24:MI')",
                (int(channel_id), me["id"], text)
            )
            post_id, ts = cur.fetchone()
            conn.commit()
            return ok({"post": {"id": post_id, "text": text, "author": me["display_name"], "time": ts}})

        return err(400, "Неизвестное действие")

    finally:
        cur.close()
        conn.close()
