# Implementation Plan — Persistent Conversational AI Operating System & Live Data Pipeline

This plan outlines the implementation to transform **NeuroLearn OS** into a persistent, conversational AI operating system. It addresses silence-based auto-processing, continuous listening mode, interruptible voice UX, a global action registry/executor, real-time lecture transcription, and the complete removal of seeded mock data in favor of live LLM/database pipelines.

---

## Proposed Changes

### 1. Frontend: Real-time Silence Detection & Persistent Continuous UX

#### [NEW] [silenceDetector.ts](file:///e:/NeuroLearn%20OS/src/services/voice/silenceDetector.ts)
* Create `SilenceDetector` class that tracks voice activity.
* Automatically resets when new speech chunks arrive.
* Triggers an `onSilence` callback when silence is detected for more than 2.5 seconds (or a configurable window).

#### [MODIFY] [sessionManager.ts](file:///e:/NeuroLearn%20OS/src/services/voice/sessionManager.ts)
* Integrate `SilenceDetector` with the SpeechRecognition STT loop.
* Implement **Continuous Conversation Mode**:
  * Microphone session starts and remains active continuously.
  * When silence is detected, automatically stop STT, send the transcript as a `text_command` to the backend, clear the local transcript buffer, and transition status to `processing`.
  * When a voice playback finishes (either base64 WAV play ended or Web Speech synthesis completes), automatically restart STT.
* Implement **Interruptible Real-time Voice UX**:
  * Track active audio elements or SpeechSynthesis utterances.
  * If the user clicks the microphone button or starts speaking a new command, immediately interrupt any active TTS playback, clear active actions, and process the new speech input.
* Maintain a persistent state even across route changes by wrapping states in a global context.

---

### 2. Frontend: Action Registry & Executor

#### [NEW] [actionRegistry.ts](file:///e:/NeuroLearn%20OS/src/actions/actionRegistry.ts)
* Implement a central registry of all discoverable frontend capabilities.
* Register navigation actions, lecture recording controls, quiz generators, notes, and settings.

#### [NEW] [actionExecutor.ts](file:///e:/NeuroLearn%20OS/src/actions/actionExecutor.ts)
* Receives structured action JSON from the AI Agent (WebSocket response actions).
* Maps actions (e.g. `{ action: "navigate", target: "tutor" }`) to registered handlers.
* Executes route transitions, state updates, and triggers corresponding workspace actions.

#### [MODIFY] [AppLayout.tsx](file:///e:/NeuroLearn%20OS/src/components/AppLayout.tsx)
* Bootstraps the action registry on app load.
* Intercepts `agent_action` events and routes them to `actionExecutor` instead of hardcoded switch cases.
* Wire the global top bar mic button to work seamlessly in continuous conversation mode.

---

### 3. Frontend: Live Lecture Transcription in Lecture Studio

#### [MODIFY] [LectureStudio.tsx](file:///e:/NeuroLearn%20OS/src/pages/LectureStudio.tsx)
* Replace the hardcoded `transcriptLines` list with a dynamic state `activeLectureTranscript` stored in `appStore.ts`.
* When recording starts, request microphone stream and start browser STT specifically for the lecture.
* Render speech lines with live timestamps (`00:01`, etc.) in real time.
* As the professor speaks, send `lecture_chunk` events over the WebSocket to the agent service.
* Intercept `concept_detected` events from the WebSocket and render them as concept blocks (e.g. `[CONCEPT DETECTED: BCNF]`) in the transcription log.
* When recording is stopped (either manually or by background AI command "Stop lecture"):
  * Call a POST API `/api/analytics/lectures` to save the lecture transcript, run the LLM summarization pipeline, generate dynamic flashcards/quizzes, update the concept graph, and reload the library.

---

### 4. Backend: Dynamic Transcription Processing & Live Analytical Pipelines

#### [MODIFY] [main.py](file:///e:/NeuroLearn%20OS/agent_service/main.py)
* Add support for `lecture_chunk` event type in the WebSocket endpoint `/ws/agent-stream`.
* Implement simple keyword-based or semantic concept detection (e.g. finding "BCNF", "B+ Tree", "TLB", "ACID", "Starvation") in the lecture stream and return a `concept_detected` event.

#### [MODIFY] [analytics.py](file:///e:/NeuroLearn%20OS/backend/routers/analytics.py)
* Import database models for `DBConcept`, `DBFlashcard`, `DBQuizQuestion`.
* Add `POST /api/analytics/lectures` endpoint:
  * Accept lecture metadata and compiled transcript.
  * Use the LLM provider (Groq) to:
    * Summarize the transcript and extract key concepts.
    * Generate 3-5 SM-2 compatible flashcards for those concepts.
    * Generate 2-3 quiz questions for testing.
  * Save the new lecture, flashcards, quiz questions, and concepts in the SQLite database.
  * Dynamically update concepts graph nodes and relations.

---

### 5. Frontend & Backend: Mock Data Removal

* We will clean out any static arrays or seeded placeholders in the following files:
  * [appStore.ts](file:///e:/NeuroLearn%20OS/src/store/appStore.ts): Initial states for concepts, flashcards, and quizzes initialized to empty arrays.
  * [Dashboard.tsx](file:///e:/NeuroLearn%20OS/src/pages/Dashboard.tsx): Ensure it fetches and renders only actual SQLite query records.
  * [AiTutor.tsx](file:///e:/NeuroLearn%20OS/src/pages/AiTutor.tsx): Connect conversation bubbles to actual message history.
  * [RevisionCenter.tsx](file:///e:/NeuroLearn%20OS/src/pages/RevisionCenter.tsx): Use active SQLite flashcards and dynamic quiz questions.
  * [KnowledgeGraph.tsx](file:///e:/NeuroLearn%20OS/src/pages/KnowledgeGraph.tsx): Render graph nodes dynamically from database concepts.

---

## Verification Plan

### Automated & Manual Tests
1. **Silence Auto-Process Test**:
   * Click mic button, speak "Open lecture studio" and stop talking.
   * Verify that after 2.5 seconds of silence, the transcript is automatically finalized, sent to the server, and executed without manual clicks.
2. **Continuous Conversation Test**:
   * Verify that after the assistant completes speaking or executing an action, the microphone restarts automatically.
3. **Real-time Lecture Transcription**:
   * Go to Lecture Studio and start recording.
   * Speak out database concepts (e.g. "Today we discuss BCNF and B+ Tree indexing").
   * Verify that the live transcript renders with timestamps in real time, concept detection alerts appear in the logs, and stopping the lecture builds a real library item, flashcards, and quizzes.
4. **Live Data and Graph Updates**:
   * Verify the Knowledge Graph page displays only real nodes generated from the lectures.
