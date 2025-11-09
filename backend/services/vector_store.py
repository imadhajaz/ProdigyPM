import chromadb
from chromadb.config import Settings

chroma_client = chromadb.Client(Settings(
    persist_directory="./chroma_data"
))

def add_document(collection_name, doc_id, text, metadata=None):
    collection = chroma_client.get_or_create_collection(name=collection_name)
    collection.add(
        documents=[text],
        ids=[doc_id],
        metadatas=[metadata or {}]
    )

def search_document(collection_name, query, top_k=3):
    collection = chroma_client.get_collection(name=collection_name)
    results = collection.query(query_texts=[query], n_results=top_k)
    return results
