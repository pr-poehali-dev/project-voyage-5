"""Редактирование профиля пользователя в приложении Гроза."""
import json
import os
import psycopg2

COLORS = ["#5865f2", "#eb459e", "#57f287", "#fee75c", "#ed4245", "#00b0f4", "#ff7043", "#9b59b6"]


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


def get_user(cur, session_id):
    if not session_id:
        return None
    cur.execute(
        "SELECT u.id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = %s",
        (session_id,)
    )
    row = cur.fetchone()
    return row[0] if row else None


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors(), "body": ""}

    method = event.get("httpMethod", "GET")
    session_id = (event.get("headers") or {}).get("X-Session-Id")
    body = json.loads(event.get("body") or "{}")

    conn = get_conn()
    cur = conn.cursor()

    try:
        user_id = get_user(cur, session_id)
        if not user_id:
            return err(401, "Не авторизован")

        # GET — получить профиль
        if method == "GET":
            cur.execute(
                "SELECT id, username, display_name, avatar_color, bio FROM users WHERE id = %s",
                (user_id,)
            )
            row = cur.fetchone()
            if not row:
                return err(404, "Пользователь не найден")
            return ok({
                "user": {
                    "id": row[0], "username": row[1], "display_name": row[2],
                    "avatar_color": row[3], "bio": row[4] or ""
                }
            })

        # POST — обновить профиль
        if method == "POST":
            display_name = (body.get("display_name") or "").strip()
            bio = (body.get("bio") or "").strip()
            avatar_color = body.get("avatar_color") or ""
            new_username = (body.get("username") or "").strip().lower()

            updates = []
            values = []

            if display_name:
                if len(display_name) > 64:
                    return err(400, "Имя слишком длинное")
                updates.append("display_name = %s")
                values.append(display_name)

            if bio is not None:
                if len(bio) > 200:
                    return err(400, "Bio слишком длинное (макс 200 символов)")
                updates.append("bio = %s")
                values.append(bio)

            if avatar_color and avatar_color in COLORS:
                updates.append("avatar_color = %s")
                values.append(avatar_color)

            if new_username:
                if len(new_username) < 3 or len(new_username) > 32:
                    return err(400, "Юзернейм: от 3 до 32 символов")
                if not new_username.replace("_", "").replace(".", "").isalnum():
                    return err(400, "Юзернейм: только буквы, цифры, _ и .")
                cur.execute("SELECT id FROM users WHERE username = %s AND id != %s", (new_username, user_id))
                if cur.fetchone():
                    return err(409, "Юзернейм уже занят")
                updates.append("username = %s")
                values.append(new_username)

            if not updates:
                return err(400, "Нечего обновлять")

            updates.append("updated_at = NOW()")
            values.append(user_id)
            cur.execute(
                f"UPDATE users SET {', '.join(updates)} WHERE id = %s RETURNING id, username, display_name, avatar_color, bio",
                values
            )
            row = cur.fetchone()
            conn.commit()

            return ok({
                "user": {
                    "id": row[0], "username": row[1], "display_name": row[2],
                    "avatar_color": row[3], "bio": row[4] or ""
                }
            })

        return err(400, "Неизвестный метод")

    finally:
        cur.close()
        conn.close()
