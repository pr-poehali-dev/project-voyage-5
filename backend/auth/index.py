"""Регистрация, вход и проверка сессии для приложения Гроза."""
import json
import os
import hashlib
import random
import psycopg2


COLORS = ["#5865f2", "#eb459e", "#57f287", "#fee75c", "#ed4245", "#00b0f4", "#ff7043"]


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


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


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors(), "body": ""}

    method = event.get("httpMethod", "GET")
    body = json.loads(event.get("body") or "{}")
    action = body.get("action") or ""
    session_id = (event.get("headers") or {}).get("X-Session-Id")

    conn = get_conn()
    cur = conn.cursor()

    try:
        if method == "GET":
            if not session_id:
                return err(401, "Нет сессии")
            cur.execute(
                "SELECT u.id, u.username, u.display_name, u.avatar_color FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = %s",
                (session_id,)
            )
            row = cur.fetchone()
            if not row:
                return err(401, "Сессия не найдена")
            return ok({"user": {"id": row[0], "username": row[1], "display_name": row[2], "avatar_color": row[3]}})

        if action == "register":
            username = (body.get("username") or "").strip().lower()
            display_name = (body.get("display_name") or "").strip()
            password = body.get("password") or ""

            if not username or not display_name or not password:
                return err(400, "Заполните все поля")
            if len(username) < 3 or len(username) > 32:
                return err(400, "Юзернейм: от 3 до 32 символов")
            if not username.replace("_", "").replace(".", "").isalnum():
                return err(400, "Юзернейм: только буквы, цифры, _ и .")

            cur.execute("SELECT id FROM users WHERE username = %s", (username,))
            if cur.fetchone():
                return err(409, "Юзернейм уже занят")

            color = random.choice(COLORS)
            cur.execute(
                "INSERT INTO users (username, display_name, password_hash, avatar_color) VALUES (%s, %s, %s, %s) RETURNING id",
                (username, display_name, hash_password(password), color)
            )
            user_id = cur.fetchone()[0]
            cur.execute("INSERT INTO sessions (user_id) VALUES (%s) RETURNING id", (user_id,))
            new_session = str(cur.fetchone()[0])
            conn.commit()

            return ok({
                "session_id": new_session,
                "user": {"id": user_id, "username": username, "display_name": display_name, "avatar_color": color}
            })

        if action == "login":
            username = (body.get("username") or "").strip().lower()
            password = body.get("password") or ""

            cur.execute(
                "SELECT id, username, display_name, avatar_color FROM users WHERE username = %s AND password_hash = %s",
                (username, hash_password(password))
            )
            row = cur.fetchone()
            if not row:
                return err(401, "Неверный юзернейм или пароль")

            cur.execute("INSERT INTO sessions (user_id) VALUES (%s) RETURNING id", (row[0],))
            new_session = str(cur.fetchone()[0])
            conn.commit()

            return ok({
                "session_id": new_session,
                "user": {"id": row[0], "username": row[1], "display_name": row[2], "avatar_color": row[3]}
            })

        if action == "logout":
            if session_id:
                cur.execute("UPDATE sessions SET user_id = NULL WHERE id = %s", (session_id,))
                conn.commit()
            return ok({"ok": True})

        return err(400, "Неизвестное действие")

    finally:
        cur.close()
        conn.close()
