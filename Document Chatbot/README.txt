							LAZARUS AI

REQUIREMENTS: APPROXIMATELY 10GB STORAGE SPACE

1) Download Ollama from ollama.com

2) Setup ollama from the downloaded path, run, install

3) Ensure you have downloaded the latest version of python (3.13.3) from: 
	https://www.python.org/downloads/

4) When setting up python from the downloaded path, 
you must check the "Add python.exe to PATH" box before you click "Install Now"

5) Go to command prompt by ( win + r , type "cmd" ), 
and perform these commands: (you can ctrl + c and ctrl + v them)
 
pip install streamlit pymupdf pdfplumber docx2txt langchain langchain-ollama nltk langchain-community pyttsx3 gTTS deep-translator speechrecognition pyaudio 

ollama pull 3.1

ollama pull deepseek-r1:1.5b

ollama pull qwen3:4b

6) Now that you had everything set up, you can run the code from a compiler (Preferably VS Code)

In compiler,

- Open folder
- open terminal by pressing (win and "~") 
- change directory if needed by (cd PATHTOFILE, eg cd C:\PATHTOFILE)
- streamlit run Lazarus.py


**ALWAYS ENSURE THAT 
**A FOLDER "chat_histories" and a file named "users.json" 
**IS PRESENT IN THE PROJECT FOLDER




