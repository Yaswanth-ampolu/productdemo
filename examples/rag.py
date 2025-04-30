import sys
import os
import re
import numpy as np # type: ignore
import pdfplumber # type: ignore
import logging
import shutil
from PyQt5.QtWidgets import ( # type: ignore
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QPushButton, QLineEdit, QLabel, QFileDialog, QTextEdit, QMessageBox,
    QListWidget, QSizePolicy, QFrame, QProgressBar
)
from PyQt5.QtCore import Qt, QThread, pyqtSignal, QTimer # type: ignore
from PyQt5.QtGui import QColor, QFont, QPalette # type: ignore
from langchain.text_splitter import RecursiveCharacterTextSplitter # type: ignore
import chromadb # type: ignore
from ollama import Client as OllamaClient
from ollama import ResponseError

# --- RAG Backend Logic ---
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Initialize ChromaDB with dimension check
EXPECTED_EMBEDDING_DIM = 768  # nomic-embed-text produces 768-dimensional embeddings

# Clean up existing ChromaDB if dimension mismatch is likely
if os.path.exists("./chroma_db"):
    logging.warning("Existing ChromaDB directory found. Deleting to reset collection for 768-dimensional embeddings.")
    try:
        shutil.rmtree("./chroma_db")
    except Exception as e:
        logging.error(f"Error deleting chroma_db directory: {e}")

client = chromadb.PersistentClient(path="./chroma_db")
# Recreate collection to ensure correct dimensionality
try:
    client.delete_collection(name="rag_docs")
except Exception:
    pass  # Ignore if collection doesn't exist
collection = client.create_collection(name="rag_docs")  # Fresh collection with no dimension preset

ollama_client = None
try:
    ollama_client = OllamaClient(host='http://localhost:11434')
    models = ollama_client.list()['models']
    if not any(model['name'].startswith('nomic-embed-text') for model in models):
        raise ValueError("nomic-embed-text model is not available in Ollama. Please pull it using 'ollama pull nomic-embed-text'.")
    # Verify embedding dimension
    test_embedding = ollama_client.embeddings(model="nomic-embed-text", prompt="test")['embedding']
    if len(test_embedding) != EXPECTED_EMBEDDING_DIM:
        raise ValueError(f"nomic-embed-text produced {len(test_embedding)}-dimensional embeddings, expected {EXPECTED_EMBEDDING_DIM}.")
    logging.info("Ollama client connected successfully with nomic-embed-text.")
except Exception as e:
    logging.error(f"Could not connect to Ollama or verify nomic-embed-text model: {e}. Please ensure Ollama is running and the 'nomic-embed-text' and 'qwen2' models are available.")

search_history = []

def process_tlef_layers(content):
    pattern = r'LAYER\s+(M\d+)[\s\S]*?END\s+\1'
    layers = [m.group(0) for m in re.finditer(pattern, content)]
    return layers, len(layers), None

def process_pdf_chunks(file_path):
    all_text = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            all_text = "".join([page.extract_text() + "\n" for page in pdf.pages if page.extract_text()])
    except Exception as e:
        logging.error(f"Error extracting text from PDF {file_path}: {e}")
        return [], 0, str(e)

    if not all_text:
        return [], 0, "No readable text found in PDF."

    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = text_splitter.split_text(all_text)
    return chunks, len(chunks), None

def rag_query(user_query):
    if collection.count() == 0:
        return "?? No documents indexed yet. Please upload a file first.", None

    global ollama_client
    if ollama_client is None:
        try:
            ollama_client = OllamaClient(host='http://localhost:11434')
            models = ollama_client.list()['models']
            if not any(model['name'].startswith('nomic-embed-text') for model in models):
                raise ValueError("nomic-embed-text model is not available.")
            logging.info("Ollama client connected successfully on retry.")
        except Exception as e:
            logging.error(f"Could not connect to Ollama on retry: {e}")
            return "Ollama client is not connected. Cannot generate answers.", None

    context = ""
    try:
        query_embedding = ollama_client.embeddings(model="nomic-embed-text", prompt=user_query)['embedding']
        results = collection.query(query_embeddings=[query_embedding], n_results=5, include=['documents', 'metadatas'])
        retrieved_docs = results['documents'][0] if results and results['documents'] else []
        context = "\n\n---\n\n".join(retrieved_docs)
    except Exception as e:
        logging.error(f"Error during retrieval from ChromaDB or embedding generation: {e}")
        return f"An error occurred during retrieval: {e}", "retrieval_error"

    if not context:
        return "Could not find relevant information in the indexed documents.", None

    try:
        logging.info("Generating response with Ollama...")
        response = ollama_client.chat(model="qwen2", messages=[
            {"role": "system", "content": "You are a helpful assistant that answers questions truthfully and directly based on the provided context. If the answer is not in the context, state that you cannot answer based on the provided information."},
            {"role": "user", "content": f"Use the following context to answer the question:\n\nContext:\n{context}\n\nQuestion: {user_query}"}
        ])
        return response['message']['content'], None
    except ResponseError as e:
        logging.error(f"Ollama chat error: {e}")
        return f"Error generating response: {e}", "ollama_error"
    except Exception as e:
        logging.error(f"Unexpected chat error: {e}")
        return f"An unexpected error occurred during response generation: {e}", "ollama_error"

class FileProcessorThread(QThread):
    finished = pyqtSignal(str, int, str)
    progress = pyqtSignal(str)

    def __init__(self, file_path):
        super().__init__()
        self.file_path = file_path

    def run(self):
        file_name = os.path.basename(self.file_path)
        self.progress.emit(f"Processing {file_name}...")

        file_extension = os.path.splitext(self.file_path)[1].lower()
        chunks = []
        total_new_chunks = 0
        error_message = None

        if file_extension == '.pdf':
            chunks, total_new_chunks, error_message = process_pdf_chunks(self.file_path)
        elif file_extension in ['.tlef', '.lef', '.tech', '.csv', '.txt']:
            try:
                with open(self.file_path, 'r') as f:
                    raw_content = f.read()
                if file_extension in ['.tlef', '.lef']:
                    chunks, total_new_chunks = process_tlef_layers(raw_content)
                else:
                    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
                    chunks = splitter.split_text(raw_content)
                    total_new_chunks = len(chunks)
            except Exception as e:
                error_message = f"Could not read or process file: {e}"
                logging.error(error_message)
        else:
            error_message = f"Unsupported file type: {file_extension}"
            logging.warning(error_message)

        if error_message:
            self.finished.emit(f"Failed to process {file_name}", 0, error_message)
            return

        if not chunks:
            self.finished.emit(f"No meaningful content extracted from {file_name}", 0, "No content extracted")
            return

        indexed_count_for_file = 0
        try:
            chunk_ids = [f"{file_name}_chunk_{i}_{hash(chunk)}" for i, chunk in enumerate(chunks)]
            chunk_metadatas = [{"source": file_name}] * total_new_chunks

            self.progress.emit(f"Generating embeddings for {file_name} ({total_new_chunks} chunks)...")
            chunk_embeddings = []
            for chunk in chunks:
                embedding = ollama_client.embeddings(model="nomic-embed-text", prompt=chunk)['embedding']
                if len(embedding) != EXPECTED_EMBEDDING_DIM:
                    raise ValueError(f"Embedding dimension mismatch: got {len(embedding)}, expected {EXPECTED_EMBEDDING_DIM}")
                chunk_embeddings.append(embedding)

            batch_size = 100
            self.progress.emit(f"Indexing {len(chunks)} chunks from {file_name} into ChromaDB...")
            for i in range(0, total_new_chunks, batch_size):
                batch_ids = chunk_ids[i:i+batch_size]
                batch_chunks = chunks[i:i+batch_size]
                batch_embeddings = chunk_embeddings[i:i+batch_size]
                batch_metadatas = chunk_metadatas[i:i+batch_size]

                collection.add(
                    ids=batch_ids,
                    documents=batch_chunks,
                    embeddings=batch_embeddings,
                    metadatas=batch_metadatas
                )
                indexed_count_for_file += len(batch_ids)
                self.progress.emit(f"Indexed {indexed_count_for_file}/{len(chunks)} chunks...")

            logging.info(f"Successfully indexed {total_new_chunks} chunks from {file_name} into ChromaDB.")
            self.finished.emit(f"File '{file_name}' uploaded successfully.", total_new_chunks, None)

        except Exception as e:
            error_message = f"Error indexing data into ChromaDB or generating embeddings: {e}"
            logging.error(error_message)
            self.finished.emit(f"Indexing failed for {file_name}", 0, error_message)

class QueryThread(QThread):
    finished = pyqtSignal(str, str)
    progress = pyqtSignal(str)

    def __init__(self, query):
        super().__init__()
        self.query = query

    def run(self):
        self.progress.emit("Processing query...")
        answer, error_type = rag_query(self.query)
        self.finished.emit(answer, error_type)

class RAGApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Sierra Edge.ai")
        self._init_ui()
        self._connect_signals()
        self.search_history_list = []

    def _init_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        main_layout = QVBoxLayout()
        central.setLayout(main_layout)

        dark_palette = QPalette()
        dark_palette.setColor(QPalette.Window, QColor(30, 30, 30))
        dark_palette.setColor(QPalette.WindowText, QColor(255, 255, 255))
        dark_palette.setColor(QPalette.Base, QColor(50, 50, 50))
        dark_palette.setColor(QPalette.AlternateBase, QColor(30, 30, 30))
        dark_palette.setColor(QPalette.ToolTipBase, QColor(255, 255, 220))
        dark_palette.setColor(QPalette.ToolTipText, QColor(0, 0, 0))
        dark_palette.setColor(QPalette.Text, QColor(255, 255, 255))
        dark_palette.setColor(QPalette.Button, QColor(50, 50, 50))
        dark_palette.setColor(QPalette.ButtonText, QColor(255, 255, 255))
        dark_palette.setColor(QPalette.BrightText, QColor(255, 0, 0))
        dark_palette.setColor(QPalette.Link, QColor(42, 130, 218))
        dark_palette.setColor(QPalette.Highlight, QColor(42, 130, 218))
        dark_palette.setColor(QPalette.HighlightedText, QColor(0, 0, 0))
        self.setPalette(dark_palette)

        stylesheet = """
            QToolTip { color: #000; background-color: #fff; border: 1px solid #000; }
            QLabel { color: white; font-size: 11pt; font-weight: 400; }
            QLabel#TitleLabel { font-size: 18pt; font-weight: bold; }
            QLabel#AskLabel { font-weight: bold; margin-top: 10px; }
            QPushButton {
                background-color: #4CAF50;
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                border: none;
                font-size: 11pt;
                font-weight: 400;
            }
            QPushButton:hover {
                background-color: #45a049;
            }
            QPushButton#AskButton {
                background-color: #2196F3;
            }
            QPushButton#AskButton:hover {
                background-color: #0b7dda;
            }
            QLineEdit {
                padding: 8px;
                border: 1px solid #555;
                border-radius: 4px;
                color: white;
                background-color: #333;
                font-size: 11pt;
                font-weight: 400;
            }
            QLineEdit:focus {
                border: 1px solid #4CAF50;
            }
            QTextEdit {
                padding: 8px;
                border: 1px solid #555;
                border-radius: 4px;
                color: white;
                background-color: #333;
                font-size: 11pt;
                font-weight: 400;
            }
            QListWidget {
                padding: 8px;
                border: 1px solid #555;
                border-radius: 4px;
                color: white;
                background-color: #333;
                font-size: 10pt;
                font-weight: 400;
            }
            QListWidget::item {
                padding: 5px;
                border-bottom: 1px solid #555;
            }
            QListWidget::item:selected {
                background-color: #555;
            }
            QProgressBar {
                border: 1px solid #555;
                border-radius: 5px;
                text-align: center;
                color: white;
                background-color: #333;
            }
            QProgressBar::chunk {
                background-color: #4CAF50;
                width: 20px;
            }
        """
        self.setStyleSheet(stylesheet)

        title_layout = QHBoxLayout()
        self.sierra_label = QLabel("Sierra Edge.ai")
        self.sierra_label.setObjectName("TitleLabel")
        self.sierra_label.setStyleSheet("color: red;")
        title_layout.addWidget(self.sierra_label, alignment=Qt.AlignLeft | Qt.AlignTop)
        title_layout.addStretch(1)
        main_layout.addLayout(title_layout)

        upload_layout = QHBoxLayout()
        self.upload_btn = QPushButton("Upload File")
        self.upload_btn.setObjectName("UploadButton")
        self.process_progress = QProgressBar()
        self.process_progress.setTextVisible(False)
        self.process_progress.setMaximumHeight(10)
        self.process_progress.hide()
        self.status_label = QLabel(f"Status: Ready to upload. Total indexed chunks: {collection.count()}")
        self.status_label.setObjectName("StatusLabel")
        upload_layout.addWidget(self.upload_btn)
        upload_layout.addWidget(self.process_progress, 1)
        upload_layout.addWidget(self.status_label, 2)
        main_layout.addLayout(upload_layout)

        ask_label = QLabel("Ask me a question:")
        ask_label.setObjectName("AskLabel")
        main_layout.addWidget(ask_label)

        query_layout = QHBoxLayout()
        self.query_input = QLineEdit()
        self.query_input.setPlaceholderText("Enter your question here...")
        self.ask_btn = QPushButton("Ask")
        self.ask_btn.setObjectName("AskButton")
        query_layout.addWidget(self.query_input)
        query_layout.addWidget(self.ask_btn)
        main_layout.addLayout(query_layout)

        results_history_layout = QHBoxLayout()
        results_layout = QVBoxLayout()
        results_layout.addWidget(QLabel("Answer:"))
        self.result_box = QTextEdit()
        self.result_box.setReadOnly(True)
        results_layout.addWidget(self.result_box, 1)
        results_history_layout.addLayout(results_layout, 3)

        history_layout = QVBoxLayout()
        history_label = QLabel("Search History:")
        history_layout.addWidget(history_label)
        self.history_list_widget = QListWidget()
        history_layout.addWidget(self.history_list_widget, 1)
        results_history_layout.addLayout(history_layout, 1)
        main_layout.addLayout(results_history_layout, 1)

    def _connect_signals(self):
        self.upload_btn.clicked.connect(self.upload_file)
        self.ask_btn.clicked.connect(self.ask_query)
        self.query_input.returnPressed.connect(self.ask_query)
        self.history_list_widget.itemClicked.connect(self._display_history_item)

    def upload_file(self):
        if hasattr(self, 'file_processor_thread') and self.file_processor_thread.isRunning():
            QMessageBox.warning(self, "Busy", "A file is already being processed. Please wait.")
            return

        path, _ = QFileDialog.getOpenFileName(
            self, "Upload File", "",
            "Supported Files (*.tlef *.lef *.tech *.pdf *.csv);;All Files (*)"
        )
        if not path:
            return

        file_name = os.path.basename(path)
        self.status_label.setText(f"Processing: {file_name}...")
        self.result_box.setPlainText("")
        self.process_progress.show()
        self.process_progress.setRange(0, 0)

        self.file_processor_thread = FileProcessorThread(path)
        self.file_processor_thread.finished.connect(self._on_file_processing_finished)
        self.file_processor_thread.progress.connect(self.status_label.setText)
        self.file_processor_thread.start()

    def _on_file_processing_finished(self, status_msg, total_new_chunks, error_message):
        self.process_progress.hide()
        self.process_progress.setRange(0, 100)

        if error_message:
            QMessageBox.critical(self, "Processing Error", f"{status_msg}\nDetails: {error_message}")
            self.status_label.setText(f"Status: {status_msg}. Total indexed chunks: {collection.count()}")
        else:
            self.status_label.setText(f"Status: {status_msg}. Total indexed chunks: {collection.count()}")
            self.result_box.setPlainText(f"{status_msg}\nReady to answer questions based on {collection.count()} indexed chunks.")

    def ask_query(self):
        query = self.query_input.text().strip()
        if not query:
            self.result_box.setPlainText("Please enter a question.")
            return

        if hasattr(self, 'query_thread') and self.query_thread.isRunning():
            QMessageBox.warning(self, "Busy", "A query is already being processed. Please wait.")
            return

        self.result_box.setPlainText("Thinking...")
        self.status_label.setText("Status: Answering question...")

        self.query_thread = QueryThread(query)
        self.query_thread.finished.connect(self._on_query_finished)
        self.query_thread.progress.connect(self.status_label.setText)
        self.query_thread.start()

    def _on_query_finished(self, answer, error_type):
        self.status_label.setText(f"Status: Ready. Total indexed chunks: {collection.count()}")

        query = self.query_input.text().strip()
        if query:
            self.search_history_list.append({"query": query, "answer": answer})
            self._update_history_list_widget()

        self.result_box.setPlainText(answer)

    def _update_history_list_widget(self):
        self.history_list_widget.clear()
        for item in reversed(self.search_history_list):
            self.history_list_widget.addItem(item["query"])

    def _display_history_item(self, item):
        selected_query = item.text()
        for history_item in self.search_history_list:
            if history_item["query"] == selected_query:
                self.result_box.setPlainText(history_item["answer"])
                self.query_input.setText(selected_query)
                break

if __name__ == '__main__':
    logging.basicConfig(level=logging.ERROR, format='%(asctime)s - %(levelname)s - %(message)s')
    app = QApplication(sys.argv)
    app.setStyle("Fusion")
    window = RAGApp()
    window.resize(900, 700)
    window.show()
    sys.exit(app.exec_())
