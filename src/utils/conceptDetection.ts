/** Client-side concept detection — mirrors backend concept_keywords patterns. */

const KEYWORD_MAP: [string, string][] = [
  ["data structure", "Data Structures"],
  ["data structures", "Data Structures"],
  [" dsa ", "Data Structures and Algorithms"],
  ["linked list", "Linked Lists"],
  ["stack", "Stacks"],
  ["queue", "Queues"],
  ["graph", "Graphs"],
  ["binary tree", "Binary Trees"],
  ["tree", "Trees"],
  ["dynamic programming", "Dynamic Programming"],
  ["time complexity", "Time Complexity"],
  ["space complexity", "Space Complexity"],
  ["big o", "Big-O Notation"],
  ["hash table", "Hash Tables"],
  ["hash map", "Hash Maps"],
  ["sorting", "Sorting Algorithms"],
  ["recursion", "Recursion"],
  ["binary search", "Binary Search"],
  ["depth-first", "Depth-First Search"],
  ["breadth-first", "Breadth-First Search"],
  [" dfs ", "Depth-First Search"],
  [" bfs ", "Breadth-First Search"],
  ["bcnf", "BCNF"],
  ["normalization", "Normalization"],
  ["normal form", "Normalization"],
  ["acid", "ACID Properties"],
  ["deadlock", "Deadlock Prevention"],
  ["virtual memory", "Virtual Memory"],
  ["paging", "Paging"],
  ["semaphore", "Semaphores"],
  ["scheduling", "CPU Scheduling"],
  ["algorithm", "Algorithms"],
  ["algorithms", "Algorithms"],
];

export function detectConceptsFromText(text: string, max = 6): string[] {
  if (!text || text.trim().length < 5) return [];
  const lower = ` ${text.toLowerCase()} `;
  const found: string[] = [];
  const seen = new Set<string>();

  for (const [keyword, concept] of KEYWORD_MAP) {
    if (lower.includes(keyword) && !seen.has(concept.toLowerCase())) {
      found.push(concept);
      seen.add(concept.toLowerCase());
    }
  }
  return found.slice(0, max);
}
