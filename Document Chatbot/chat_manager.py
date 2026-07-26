import os
import json

CHAT_ROOT = "chat_histories"

#FOR CHAT WINDOWS
def get_user_folder(username):
    path = os.path.join(CHAT_ROOT, username)
    os.makedirs(path, exist_ok=True)
    return path

def get_chat_path(username, chat_name):
    user_folder = get_user_folder(username)
    return os.path.join(user_folder, f"{chat_name}.json")

def list_user_chats(username):
    folder = get_user_folder(username)
    return [f.replace(".json", "") for f in os.listdir(folder) if f.endswith(".json")]

def load_chat_history(username, chat_name):
    path = get_chat_path(username, chat_name)
    if os.path.exists(path):
        with open(path, "r") as f:
            data = json.load(f)
            if isinstance(data, list):  
                new_data = {"chat_history": data, "document_text": ""}
                save_chat_history(username, chat_name, new_data)  # Update the file
                return data, ""
            return data.get("chat_history", []), data.get("document_text", "")
    return [], ""

def save_chat_history(username, chat_name, chat_data):
    path = get_chat_path(username, chat_name)
    with open(path, "w") as f:
        json.dump(chat_data, f)

def delete_chat(username, chat_name):
    path = get_chat_path(username, chat_name)
    if os.path.exists(path):
        os.remove(path)

