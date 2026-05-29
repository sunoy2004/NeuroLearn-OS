"""
Dynamic knowledge graph builder from lecture transcript data using NetworkX.
Creates directed, weighted edges representing dependencies and relationships.
"""
import re
from typing import List, Dict, Any, Tuple
from collections import defaultdict
import networkx as nx

from backend.services.content_extractor import extract_concepts_from_transcript


def _concept_id(name: str) -> str:
    slug = re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')
    return f"con_{slug}"


def detect_relationships(concepts: List[str], transcript: str) -> List[Tuple[str, str]]:
    """Detect co-occurrence and explicit relationship patterns between concepts."""
    relationships: List[Tuple[str, str]] = []
    lower = transcript.lower()

    # Co-occurrence in same sentence
    sentences = re.split(r'(?<=[.!?])\s+', transcript)
    for sentence in sentences:
        present = [c for c in concepts if c.lower() in sentence.lower()]
        for i, a in enumerate(present):
            for b in present[i + 1:]:
                relationships.append((a, b))

    # Explicit link patterns
    link_patterns = [
        r'linked to\s+([^.]+)',
        r'related to\s+([^.]+)',
        r'builds on\s+([^.]+)',
        r'extends\s+([^.]+)',
    ]
    for concept in concepts:
        for pattern in link_patterns:
            matches = re.findall(
                rf'{re.escape(concept.lower())}\s+{pattern}', lower, re.IGNORECASE
            )
            for match in matches:
                for other in concepts:
                    if other.lower() in match.lower() and other != concept:
                        relationships.append((concept, other))

    return relationships


def build_graph_from_transcript(
    transcript: str,
    subject: str,
    existing_concepts: Dict[str, Any] | None = None,
    explicit_relationships: List[Dict[str, Any]] | None = None,
) -> List[Dict[str, Any]]:
    """
    Build/update concept nodes from transcript using NetworkX.
    Returns list of concept dicts ready for DB insertion.
    """
    if not transcript or len(transcript.strip()) < 10:
        return []

    # Extract concept names from transcript
    concept_names = extract_concepts_from_transcript(transcript)
    if not concept_names:
        return []

    # Initialize directed NetworkX graph
    G = nx.DiGraph()

    # Add all nodes
    for name in concept_names:
        G.add_node(name)

    # 1. Add explicit relationships from ConceptAgent
    if explicit_relationships:
        for rel in explicit_relationships:
            src = rel.get("from")
            dst = rel.get("to")
            rel_type = rel.get("type", "related_to")
            weight = 2.0 if rel_type == "depends_on" else 1.0
            
            # Ensure nodes exist
            if src and dst:
                if src not in G:
                    G.add_node(src)
                if dst not in G:
                    G.add_node(dst)
                
                if G.has_edge(src, dst):
                    G[src][dst]['weight'] += weight
                else:
                    G.add_edge(src, dst, weight=weight, type=rel_type)

    # 2. Fallback to heuristic co-occurrence detection if no edges added
    if G.number_of_edges() == 0:
        heuristics = detect_relationships(concept_names, transcript)
        for a, b in heuristics:
            # Add directed edge in order of appearance
            if G.has_edge(a, b):
                G[a][b]['weight'] += 1.0
            else:
                G.add_edge(a, b, weight=1.0, type="related_to")

    # Compute PageRank to determine concept centrality/importance
    try:
        pagerank = nx.pagerank(G, weight='weight')
    except Exception:
        pagerank = {node: 1.0 / len(G) for node in G.nodes}

    nodes = []
    for name in G.nodes:
        cid = _concept_id(name)
        
        # Connections are outgoing edge targets
        successors = list(G.successors(name)) if name in G else []
        connections = [_concept_id(n) for n in successors]

        # Fetch existing node properties if available
        existing = (existing_concepts or {}).get(cid)
        mastery = existing.get("mastery", 50.0) if existing else 50.0
        retention = existing.get("retention", 60.0) if existing else 60.0

        # Dynamic importance based on PageRank score
        pr_score = pagerank.get(name, 0.0)
        if pr_score > 0.15:
            importance = "High"
        elif pr_score > 0.05:
            importance = "Medium"
        else:
            importance = "Low"

        # Boost mastery slightly on review
        if existing:
            mastery = min(100.0, mastery + 5.0)
            retention = min(100.0, retention + 3.0)

        # Build list of related concept names
        related_concepts = list(G.predecessors(name)) + successors
        related_concepts = [r for r in related_concepts if r != name][:5]

        nodes.append({
            "id": cid,
            "name": name,
            "subject": subject,
            "mastery": mastery,
            "retention": retention,
            "connections": connections,
            "definition": f"Core concept representing {name} within the domain of {subject}.",
            "importance": importance,
            "related_concepts": related_concepts,
        })

    return nodes
