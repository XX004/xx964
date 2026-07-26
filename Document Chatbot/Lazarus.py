import streamlit as st
from langchain.llms import Ollama  # from langchain-ollama
import re
### FILE EXTRACTOR
import fitz  # PyMuPDF for PDFs
import pdfplumber
import docx2txt # FOR DOCX
##### PREPROCESSING
import nltk
nltk.download('stopwords')
nltk.download('punkt_tab')
#### USER REGISTER AND CHAT WINDOWS
from register import register_user, authenticate_user
from chat_manager import (
                          list_user_chats,load_chat_history,save_chat_history,
                          delete_chat
                        
)
### TEXT TO SPEECH AND TRANSLATION LIBRARIES
import pyttsx3
from gtts import gTTS
from deep_translator import GoogleTranslator
### SPEECH TO TEXT 
import speech_recognition as sr ### PYAUDIO
### TRANSLATED TEXT TO SPEECH output
import io



def incomplete_text(text):
    if any(len(line) == 1 for line in text.split("\n")):
        return True
    symbols = "!@#$%^&*()_+=[]{},.<>?/;:'\""
    symbol_count = sum(text.count(char) for char in symbols)
    if symbol_count > len(text) * 0.5:
        return True
    if text.count("\n\n") > 2:
        return True
    return False

def extract_text(file):
    """Extracts text from a PDF or DOCX file with error handling."""
    ### Extended validation to ensure there are files
    if not file:
        return None, "No file uploaded."
    text = ""

    try:
        if file.type == "application/pdf":
            with fitz.open(stream=file.read(), filetype="pdf") as doc:
                for page in doc:
                    text += page.get_text()
            ##### implementing the other pdf extractor for complexity 
             
                file.seek(0)
                with pdfplumber.open(file) as pdf:
                    text = ""
                    for page in pdf.pages:
                        text += page.extract_text() or ""

        elif file.type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            text = docx2txt.process(file)

        elif file.type == "text/plain":        
            try:
                text += file.read().decode("utf-8")
            except UnicodeDecodeError: 
                text += file.read().decode("latin-1")
            
        else:
            return None, "Unsupported file format. Please upload a PDF, DOCX,TXT."

        if not text.strip():
            return None, "The uploaded file contains no readable text."

        return text, None

    except Exception as e:
        return None, f"Error extracting text: {str(e)}"

def preprocessText (text):
    from nltk.tokenize import word_tokenize
    from nltk.corpus import stopwords
    text = re.sub(r'\d+', '', text.lower().strip())

    # Tokenize
    tokens = word_tokenize(text)

    # Remove stopwords and non-alphanumeric tokens
    stop_words = set(stopwords.words('english'))
    cleaned_tokens = [word for word in tokens if word.isalnum() and word not in stop_words]

    # Return cleaned text
    return ' '.join(cleaned_tokens)


def transcribe_voice():
    recognizer = sr.Recognizer()

    with sr.Microphone() as source:
        st.info("Please speak now...")  
        try:
            audio_data = recognizer.listen(source, timeout=6)
            text = recognizer.recognize_google(audio_data)
            return text
        except sr.WaitTimeoutError:
            st.warning("Timeout: No speech detected.")
        except sr.UnknownValueError:
            st.error("Incomprehensible. Please try again.")
        except sr.RequestError as e:
            st.error(f"Request failed: {e}")
        except Exception as e:
            st.error(f"Unexpected error: {e}")
    return ""

def tts(text, rate):
    try:
        if not text:
            st.error("No text converted to speech!")
            return
        engine = pyttsx3.init()
        engine.setProperty('rate', rate)
        # PYTTSX3 reads symbols as asterisks out loud, so we have to remove it when speech
        refined_text = text.replace("*", "")  
        engine.say(refined_text)
        engine.runAndWait()
    #### To handle errors when there is already ongoing speech
    except Exception:   
        engine.stop()

def tts_multilang(text,langcode):
    try:
        if not text:
            st.error("No text converted to speech!")
        translated_text = GoogleTranslator(source='auto', target=langcode).translate(text)
        speech = gTTS(text = translated_text, lang = langcode)
        audio_buffer = io.BytesIO()
        speech.write_to_fp(audio_buffer)
        audio_buffer.seek(0)  ### Reset buffer position
        st.audio(audio_buffer, format="audio/mp3")

    except Exception as e:
        st.error("There seems to be a problem with gTTS.")


def query_llama(user_query, document_text, chat_history,model_chose):   
    """Queries the LLaMA 3.1 model using langchain-ollama."""
    llm = Ollama(model=model_chose)
     ### Optimizing chat history so that it does not get too long and disrupt prompt in super long conversations
    recent_history = chat_history[-10:]  
    history_context = "\n".join([f"User: {q}\nAssistant: {r}" for _, q, r in recent_history])

    if model_chose == "llama3.1":
        try:
            prompt = (
                "Your name is Lazarus, a super helpful assistant created to assist with documents, if there are any, and any other questions.\n\n "
                "If you can't provide a response, always clarify it meticulously due to inappropriate or any other reasons."
                "For clear questions or requests,you must provide detailed, helpful answers. \n\n"
                "At the end of your response, include a very brief follow-up question or suggestion related to the user's query to encourage further exploration, anything to help the user drastically.\n\n"
                f"Document Content: {document_text}\n\n"
                f"Recent Chat History: {history_context}\n\n"
                f"Question: {user_query}\nAnswer:"
            )
            response = llm(prompt)
            return response.strip()
        except Exception as e:
            return f"Error has been found: {str(e)}"
    elif model_chose == "deepseek-r1:1.5b":
        try:
            prompt = (
                "Your name is Lazarus, a super helpful assistant, created to assist with documents, if there are any,and other questions.\n\n"
                "If you can't provide a response, always clarify it meticulously due to inappropriate or any othe reasons."
                "At the end of your response, include a very brief follow-up question or suggestion related to the user's query to encourage further exploration, anything to help the user drastically.\n\n"
                f"Document Content: {document_text}\n\n"
                f"Recent Chat History: {history_context}\n\n"
                f"Question: {user_query}\nAnswer:"
            )
            response = llm(prompt)
            ### to purify the <think> and </think> found in the response in the model
            clean_response = re.sub(r"<think>.*?</think>", "", response, flags=re.DOTALL).strip()
            return clean_response.strip()
        except Exception as e:
                return f"Error has been found: {str(e)}"
    elif model_chose == "qwen3:4b":
        try:
            prompt = (
                    "Instructions:\n\n"
                    "Your name is Lazarus, you are a super helpful assistant,created to assist with documents, if there are any, and any other questions.\n\n"
                    "If you can't provide a response, always clarify it meticulously due to inappropriate or any othe reasons."
                    "At the end of your response, include a very brief follow-up question or suggestion related to the user's query to encourage further exploration, anything to help the user drastically.\n\n"
                    f"Document Content: {document_text}\n\n"
                    f"Recent Chat History: {history_context}\n\n"
                    f"Question: {user_query}\nAnswer:"
                )
            response = llm(prompt)
            ### to purify the answer
            clean_response = re.sub(r"<think>.*?</think>", "", response, flags=re.DOTALL).strip()
            return clean_response.strip()
        except Exception as e:
                return f"Error has been found: {str(e)}"


def get_current_chat_data():
    if st.session_state.current_chat and st.session_state.current_chat in st.session_state.chat_windows:
        return st.session_state.chat_windows[st.session_state.current_chat]
    return {"history": [], "document_text": "", "started": False}

def is_name_valid(name):
   #### Windows does not allow specific symbols to be on file name
   #### Hence, we have to validate file names without the following symbols
    invalid_chars = "*?<>:\"/\\|"
    for char in invalid_chars:
        if char in name:
            return False
    return True

#### Function to toggle the language selectbox visibility
def toggle_language_select():
    st.session_state.show_language_select = not st.session_state.show_language_select

def main():
    st.set_page_config(page_title="Multi-Doc Chat Application Monster", page_icon=":material/smart_toy:")
    
    
    if "logged_in" not in st.session_state:
        st.session_state.logged_in = False

    if not st.session_state.logged_in: #interface before log in
        st.title(" :material/lock_person: Welcome to :red[Lazarus] Chat!")  
        st.subheader("Please log in to continue.")
        st.markdown(
        f"""
        <style>
        .stApp {{
            background-image: url("https://images.hdqwalls.com/download/sunrise-mountains-landscape-evening-5k-zt-1366x768.jpg");
            background-size: cover;
            background-position: center;
        }}  
        </style>
        """,
        unsafe_allow_html=True)   
        username = st.text_input(":red-background[Username]")
        password = st.text_input(":red-background[Password]", type="password")

        left, middle,middle2,middle3,middle4,right = st.columns(6)
        if left.button("Login"):
            if authenticate_user(username, password):
                st.session_state.logged_in = True
                st.session_state.username = username
                st.session_state.chat_windows = {}
                for chat_name in list_user_chats(username):
                    history, document_text = load_chat_history(username, chat_name)
                    st.session_state.chat_windows[chat_name] = {
                        "history": history,
                        "document_text": document_text,
                        "started": bool(history)
                    }
                if st.session_state.chat_windows:
                    st.session_state.current_chat = list(st.session_state.chat_windows.keys())[0]
                else:
                    default_chat = "Default"
                    st.session_state.chat_windows[default_chat] = {
                        "history": [],
                        "document_text": "",
                        "started": False
                    }
                    st.session_state.current_chat = default_chat
                    save_chat_history(st.session_state.username, default_chat, {
                        "chat_history": [],
                        "document_text": ""
                    })
                st.rerun()
            else:
                st.error("Invalid credentials! Please try again.")
        if right.button("Register"):
            ### Username validations
            ### 1. It must not be blank
            if not username or not password:
                if not username:
                    st.warning(":grey-background[Username cannot be blank!]")
                elif not password:
                    st.error("Password cannot be blank!")
            ### 2. It must not contain symbols
            elif not re.match(r'^[A-Za-z0-9]+$', username):
                st.warning("Username must only contain letters and digits (no symbols).")
            ### 3. It must have at least one letter
            elif not re.search(r'[A-Za-z]', username):
                st.warning("Username must include at least one letter.")
        
            elif register_user(username, password):
                st.success("Registered successfully! Please log in. :material/login:")
            else:
                st.error("Username already exists.")
        st.stop()

        

    else:
        st.markdown(
        f"""
        <style>
        .stSidebar {{
            background-image: url("https://images.pexels.com/photos/2514035/pexels-photo-2514035.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2");
            background-size: cover;
        }}
        </style>
        """,
        unsafe_allow_html=True)
        
        st.title("🐻 Hi, this is :blue[Lazarus].")
        st.header(":blue-background[What can I help you with?] ")
       
        guide = st.empty()
        guide.markdown(''':gray[Get started by uploading a PDF :memo:]''')
        ### FOR LOGGED IN USER'S CHAT WINDOWS & CHAT HISTORY
        if "username" not in st.session_state:
            st.session_state.username = ""
        if "chat_windows" not in st.session_state:
            st.session_state.chat_windows = {}
        if "current_chat" not in st.session_state:
            st.session_state.current_chat = None
        ### FOR TRANSLATE SELECT BOX
        if "show_language_select" not in st.session_state:
            st.session_state.show_language_select = False
        ### FOR TEXT TO SPEECH AUTO
        if "auto_tts" not in st.session_state:
            st.session_state.auto_tts = False
        if "last_response" not in st.session_state:
            st.session_state.last_response = None

        ### So that sidebar can be cleared later
        main_sidebar = st.sidebar.empty()
        ### Configuring sidebar
        with main_sidebar.container():
            st.markdown(
                f"""
                <style>
                .stApp {{
                    background-image: url("https://via.placeholder.com/10x100.png?text=Border");
                    background-size: cover;
                }}
                </style>
                """,
                unsafe_allow_html=True)
    
            st.subheader(f":grey-background[***Chat Windows***]")

            chat_names = list(st.session_state.chat_windows.keys())

            with st.expander("New Chat  [:material/add:]", expanded= False):
                new_chat_name = st.text_input("New Chat Name")
                if st.button("Create Chat"):
                    if new_chat_name and new_chat_name not in chat_names and len(new_chat_name)<30 and is_name_valid(new_chat_name):
                        st.session_state.chat_windows[new_chat_name] = {
                            "history": [],
                            "document_text": "",
                            "started": False
                        }
                        st.session_state.current_chat = new_chat_name
                        save_chat_history(st.session_state.username, new_chat_name, {
                            "chat_history": [],
                            "document_text": ""
                        })
                        st.rerun()
                    elif not new_chat_name:
                        st.warning("Chat name cannot be empty!")
                    elif len(new_chat_name) >30:
                        st.error("Chat name is too long :blue[ >30 chars]")
                    elif not is_name_valid(new_chat_name):
                        st.error("Chat name has :blue[inappropriate symbols]! ")
                    else:
                        st.error("Chat name already exists!")

            if chat_names:
                ### TO SELECT CHAT WINDOW
                selected_chat = st.selectbox("***Select Chat***", chat_names, index=chat_names.index(st.session_state.current_chat)if st.session_state.current_chat in chat_names else 0)
                st.session_state.current_chat = selected_chat
                if st.button(":wastebasket: Delete Current Chat"):
                    if len(chat_names) > 1:
                        delete_chat(st.session_state.username, st.session_state.current_chat)
                        del st.session_state.chat_windows[st.session_state.current_chat]
                        st.session_state.current_chat = list(st.session_state.chat_windows.keys())[0]
                        st.rerun()
                    else:
                        st.warning("Cannot delete the only chat window!")
            st.subheader("Your documents uploaded: ", help = "Warning: :red[Uploading files again will wipe your conversation history!]"
                         "\n\n:blue[This intended to improve reliability.]\n\n"
                         "\n\nSuggestion : :green[Create another chat window to retain the conversation history whilst managing both sessions of files.]"
                         "\n\n:orange[It is not recommended to upload more than 5 files as it may slow down performance!]")
            uploaded_files = st.file_uploader(":rainbow[Upload a PDF or DOCX or TXT]", type=["pdf", "docx","txt"], accept_multiple_files=True)
            if "pressed_go" not in st.session_state:
                st.session_state.pressed_go = False
                st.session_state.previous_files = None
            if uploaded_files != st.session_state.previous_files:
                st.session_state.pressed_go = False
                st.session_state.previous_files = uploaded_files
                
            if st.button("Go"):
                st.session_state.pressed_go = True
                current_chat = get_current_chat_data()
                if uploaded_files:
                    ### TO CHECK FOR NOT DUPLICATE FILE NAMES
                    allfilename = set()
                    duplicate_name = None

                    for filename in uploaded_files:
                        if filename.name in allfilename:
                            duplicate_name = filename.name
                            break
                        allfilename.add(filename.name)
                    ### TO CHECK TO UPLOADED FILES MORE THAN 6
                    if len(uploaded_files) > 6:
                         st.error("Maximum amount of files uploaded reached (6)")
                    elif duplicate_name:
                        st.error(f"File name '{duplicate_name}' already exists. Please upload files with unique names.")
                    else:
                        progress_bar = st.progress(0)
                        with st.spinner("Processing"):
                            new_text = ""
                            for i, uploaded_file in enumerate(uploaded_files):
                                text, error = extract_text(uploaded_file)
                                if text:
                                    CleanedText = preprocessText(text)
                                    new_text += CleanedText + "\n\n"
                                if error:
                                    st.session_state.pressed_go = False
                                    st.error(f":red[Error in file] {uploaded_file.name}: {error}")
                                    st.error("Please try again")
                                    break #########ADDED THIS
                                progress_bar.progress((i + 1) * 100 // len(uploaded_files))
                            if new_text:
                                current_chat["document_text"] = new_text
                                current_chat["history"] = []
                                current_chat["started"] = False
                                save_chat_history(st.session_state.username, st.session_state.current_chat, {
                                    "chat_history": current_chat["history"],
                                    "document_text": current_chat["document_text"]
                                })
                else:
                    current_chat["document_text"] = ""
                    save_chat_history(st.session_state.username, st.session_state.current_chat, {
                    "chat_history": current_chat["history"],
                    "document_text": current_chat["document_text"]
                     })
                    st.info("No files uploaded. Document text cleared.")

            # to create some spaces in the sidebar
            st.markdown("<div style='height:100px'></div>", unsafe_allow_html=True)

            model_chose = st.selectbox('What model would you like to use?',("llama3.1", "deepseek-r1:1.5b","qwen3:4b"))


            ttsrate = st.slider("Speech rate 🎙️",100,350,175)
   
            ### Chat chat history function
            if st.button("🧹 Clear Chat History"):
                current_chat = get_current_chat_data()
                current_chat["history"] = []
                current_chat["document_text"] = ""
                current_chat["started"] = False
                
                save_chat_history(st.session_state.username, st.session_state.current_chat, {
                    "chat_history": current_chat["history"],
                    "document_text": current_chat["document_text"]
                })
                ### reset the auto tts check box
                st.session_state.auto_tts = False
                st.success("Chat history cleared.")
            
            # to create some spaces in the sidebar
            st.markdown("<div style='height:20px'></div>", unsafe_allow_html=True)

            if st.button(":material/logout: :blue[Log Out]"):
                st.session_state.clear()
                st.rerun()
            st.caption("Powered by Streamlit 🎈 and Ollama Models. Built by Team 5.")


    
    ##if st.session_state.pressed_go:   
    ##if uploaded_files:  // BOTH OF THESE IF WE MUST ENFORCE USERS UPLOAD FIRST

        current_chat = get_current_chat_data()
        if "current_chat" not in st.session_state:
            st.session_state.current_chat = None
        

        temp_welcomemsg = st.empty()
        if not current_chat["started"]:
            with st.expander("Preprocessed Document(s) [Oldest uploaded to latest]", expanded=False):
                st.text_area("Text:", current_chat["document_text"], height=300, disabled=True)
            temp_welcomemsg = st.chat_message("🐻").write(f"Hello :blue[{st.session_state.username.capitalize()}], how may I help you today?")


            if "voice_input" not in st.session_state:
                st.session_state.voice_input = ""

            voice_button_placeholder = st.empty()
            voice_clicked = voice_button_placeholder.button("🎤 Voice Input (English only)")
            if voice_clicked:
                voice_text = transcribe_voice()
                if voice_text:
                    st.session_state.voice_input = voice_text
                    st.rerun()

            with st.form("chat_form"):
                ### Formatting Speech to Text

                user_query = st.text_input("Chat / Ask a question about the document(s): ", value=st.session_state.voice_input)
                submitted = st.form_submit_button("Get Answer")

                if submitted and user_query:
                    current_chat["started"] = True
                    ### TO PREVENT INTERRUPTION WHEN AI IS GENERATING RESPONSE
                    main_sidebar.empty()
                    voice_button_placeholder.empty()

                    with st.spinner("Thinking..."):
                        response = query_llama(user_query, current_chat["document_text"], current_chat["history"],model_chose)
                        current_chat["history"].append(("User: ", user_query, response))
                        ### CLEAR VOICE
                        st.session_state.voice_input = ""
                        save_chat_history(st.session_state.username, st.session_state.current_chat, {
                            "chat_history": current_chat["history"],
                            "document_text": current_chat["document_text"]
                        })
                    st.rerun()
            ### SPEECH TO TEXT
        else:

            with st.expander("Preprocessed Document(s) (Oldest uploaded to latest)", expanded=False):
                st.text_area("Text:", current_chat["document_text"], height=300, disabled=True)
            temp_welcomemsg.empty()
            for _, query, response in current_chat["history"]:
                ###st.write("🔎 **User:** ", query)
                ###st.write("🤖 **AI Response:**", response)
                st.chat_message("🔎").write(query)  
                st.chat_message("🐻").write(response)

            ###### Designing the bottom of the screen interface
            feature_buttons = st.empty()
            voice_text = None
            with feature_buttons.container():
                col1, col2,space,col3,col4,col5,col6,col7 = st.columns([0.8,1.3,0.3,0.5,0.8, 1.4,4,2])

                if col1.button("🎙️"):    
                    tts(response,ttsrate)

                with col2:
                    st.checkbox(":grey-background[:red[Auto]]",key="auto_tts")

                with col3:
                    st.markdown(":material/wifi:") 

    
                button_label = "^" if st.session_state.show_language_select else ":material/keyboard_arrow_down:"
                if col4.button(button_label, key="toggle_button",on_click=toggle_language_select):
                    st.session_state.show_language_select = not st.session_state.show_language_select

                language_options = {
                    "English": "en",
                    "Malay": "ms",
                    "Spanish": "es",
                    "French": "fr",
                    "German": "de",
                    "Italian": "it",
                    "Korean": "ko",
                    "Chinese (Simplified)": "zh-CN",
                    
                }
                ### TRANSLATE LAST RESPONSE
                if st.session_state.show_language_select:
                    selected_language = st.selectbox("Select target language:",options=list(language_options.keys()),index=0)
                    target_lang_code = language_options[selected_language] 

                if col5.button("🎙️ :earth_africa:"):
                    try:
                        tts_multilang(response,target_lang_code)
                    except Exception:
                        st.error(f"You have not selected a language!  Click :material/keyboard_arrow_down: ")
                if col6.button(":blue[Translate] :earth_asia:"):
                    try:
                        translated = GoogleTranslator(source='auto', target= target_lang_code).translate(response)
                        st.write(f":blue-background[**Translated Response:**]\n\n{translated}")
                    except Exception:
                        st.error(f"You have not selected a language to translate! Click :material/keyboard_arrow_down:")
                with col7: 
                    ### SPEECH TO TEXT
                    voice_clicked = st.button(":speaking_head_in_silhouette:")
                if voice_clicked:
                    voice_text = transcribe_voice()


            new_query = st.chat_input("Ask another question")

            if voice_text:
                new_query = voice_text

            if new_query:
                if new_query.strip():
                    #### To prevent interrupting new query when performing other actions
                    main_sidebar.empty()
                    feature_buttons.empty()


                    st.chat_message("🔎").write(new_query)

                    with st.spinner("[Thinking...]"):
                        try:
                            response = query_llama(new_query, current_chat["document_text"], current_chat["history"],model_chose)
                            current_chat["history"].append(("User: ", new_query, response))
                            st.session_state.last_response = response
                            ### Save chat history
                            save_chat_history(st.session_state.username, st.session_state.current_chat, {
                                "chat_history": current_chat["history"],
                                "document_text": current_chat["document_text"]
                            })
                        except Exception as e:
                            st.write(f"Error found! {e}")
                    ### AUTO TEXT TO SPEECH IF CHECKED
                    st.chat_message("🐻").write(response)
                    if st.session_state.auto_tts:
                        tts(response, ttsrate)

                    st.rerun()
                

if __name__ == '__main__':
    main()

