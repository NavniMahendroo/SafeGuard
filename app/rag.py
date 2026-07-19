from fastembed import TextEmbedding
import faiss
import numpy as np
from typing import List, Dict

# ==============================================================================
# REGULATORY RAG - LAZY LOAD FAISS INDEX
# ==============================================================================

class RegulatoryRAG:
    def __init__(self):
        self.model = None
        self.index = None
        self.regulations = []
        self._initialize()
    
    def _initialize(self):
        """Initialize the fastembed model and build FAISS index."""
        print("[RAG] Loading fastembed model...")
        self.model = TextEmbedding(model_name="sentence-transformers/all-MiniLM-L6-v2")
        
        # Define regulatory texts
        self.regulations = [
            {
                "id": "OISD-STD-137",
                "text": "Work Permit System in Hazardous Areas - Section 4.2: Precautions for Hot Work. Mandates atmospheric testing and active permit validation before approving welding, cutting, or spark-producing operations in explosive zones.",
                "action": "Verify atmospheric gas levels below LEL, ensure fire watch present, validate hot work permit is active."
            },
            {
                "id": "FACTORY-ACT-SEC-36",
                "text": "Factory Act Section 36: Precautions against dangerous fumes. Sub-section 2: Confined Space Entry Controls. Restricts entry and regulates overcrowding inside vessels, tanks, or pits where dangerous gas, fume, or dust is likely to present asphyxiation risks.",
                "action": "Implement confined space entry permit system, limit occupancy to authorized personnel, ensure ventilation and gas monitoring."
            },
            {
                "id": "DGMS-THERMAL-STRESS",
                "text": "DGMS Technical Circular: Heat Stress Management in Industrial Spaces. Clause 3: Workplace Temperature and Thermal Stress Standards. Prescribes work limitations and requires special equipment configurations when work is authorized in areas exceeding 65.0°C.",
                "action": "Implement thermal monitoring, provide cooling equipment, enforce work-rest cycles, suspend operations above thermal limits."
            }
        ]
        
        # Build embeddings
        texts = [reg["text"] for reg in self.regulations]
        # fastembed model.embed returns a generator of numpy arrays, we convert it to a full matrix
        embeddings = np.array(list(self.model.embed(texts)))
        
        # Build FAISS index
        dimension = embeddings.shape[1]
        self.index = faiss.IndexFlatL2(dimension)
        self.index.add(embeddings.astype('float32'))
        
        print(f"[RAG] FAISS index built with {len(self.regulations)} regulations")
    
    def retrieve(self, incident_description: str, top_k: int = 2) -> List[Dict]:
        """
        Retrieve top-k semantically similar regulations for an incident description.
        Returns list with id, text, action, and similarity_score.
        """
        if self.model is None or self.index is None:
            return []
        
        # Encode incident description
        query_embedding = np.array(list(self.model.embed([incident_description])))
        query_embedding = query_embedding.astype('float32')
        
        # Search FAISS index
        distances, indices = self.index.search(query_embedding, top_k)
        
        # Build results
        results = []
        for i, (idx, dist) in enumerate(zip(indices[0], distances[0])):
            reg = self.regulations[idx]
            # Convert L2 distance to similarity score (higher is more similar)
            similarity_score = float(1.0 / (1.0 + dist))
            results.append({
                "id": reg["id"],
                "text": reg["text"],
                "action": reg["action"],
                "similarity_score": similarity_score
            })
        
        return results

# Global instance
rag = RegulatoryRAG()
