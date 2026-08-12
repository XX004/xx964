## Projects

### [Epidemic Control](./Epidemic%20Control)
Custom SEIRD (Susceptible-Exposed-Infected-Recovered-Deceased) epidemic simulation environment for learning pandemic lockdown/reopening policies. Implements and benchmarks five Reinforced Learning algorithms — D3QN, CPO (constrained/safe policy optimization), Decision Transformer, DreamerV3-lite, and MuZero-lite — against a reward function that trades off economic output, infection spread, and mortality. Includes hyperparameter sweeps and cross-environment validation against standard control/Atari benchmarks.
**Stack:** Python, Gymnasium, PyTorch (RL agents)

### [Credit Card Fraud Detection](./Credit%20Card%20Fraud%20Detection)
Full-stack fraud detection system with a two-stage ML pipeline: a stacked ensemble (Random Forest + XGBoost + CatBoost + Isolation Forest → Logistic Regression meta-learner) trained on the ULB fraud dataset, followed by a second-stage GBM that adds Malaysian district-level context (DOSM data, spending deviation) for transactions that pass Stage 1. Delivered as a React/Flask app with Firebase auth/Firestore and Socket.IO for real-time fraud alerts, plus an admin panel for managing users, cards, and models.
**Stack:** React, Vite, Flask, Firebase, Socket.IO, scikit-learn/XGBoost/CatBoost

### [Decentralized Crowdfunding App](./Decentralized%20Crowdfunding%20App)
Kickstarter-style crowdfunding platform on Ethereum. A `Factory` contract deploys individual `Campaign` contracts; contributions are made in a custom ERC20 token, with automatic refunds if a campaign's funding goal isn't met and on-chain tracking of per-user contribution stats. Deployed/managed with Truffle, with a React frontend.
**Stack:** Solidity, Truffle, OpenZeppelin, React, Ganache

### [Document Chatbot](./Document%20Chatbot)
Local, offline RAG-style chatbot for chatting with your own PDF/DOCX/TXT files, running entirely on local LLMs via Ollama (LLaMA 3.1, DeepSeek-R1, Qwen3) — no external API calls. Includes voice input, text-to-speech, and multilingual translation of responses.
**Stack:** Streamlit, LangChain, Ollama, NLTK

