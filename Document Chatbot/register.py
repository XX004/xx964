import json
import os

USER_FILE = "users.json"

def load_users():
    if not os.path.exists(USER_FILE):
        return {Exception}
    with open(USER_FILE, "r") as f:
        return json.load(f)

def save_users(users):
    with open(USER_FILE, "w") as f:
        json.dump(users, f)

def register_user(username, password):
    users = load_users()
    if username in users:
        return False  # user already exists
    users[username] = password
    save_users(users)
    return True

def authenticate_user(username, password):
    users = load_users()
    return users.get(username) == password
