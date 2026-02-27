/**
 * useConversation — Custom hook for managing conversation state.
 * Tracks history, current state, citations, and error handling.
 */
'use client';

import { useState, useCallback } from 'react';
import { queryRAG, Message, Citation, RAGResponse } from '@/lib/rag-client';

export type ConversationState = 'idle' | 'listening' | 'processing' | 'speaking';

interface ConversationData {
  state: ConversationState;
  history: Message[];
  citations: Citation[];
  council: RAGResponse['council'] | null;
  error: string | null;
  isLoading: boolean;
}

export function useConversation() {
  const [data, setData] = useState<ConversationData>({
    state: 'idle',
    history: [],
    citations: [],
    council: null,
    error: null,
    isLoading: false,
  });

  const setState = useCallback((state: ConversationState) => {
    setData((prev) => ({ ...prev, state }));
  }, []);

  const clearError = useCallback(() => {
    setData((prev) => ({ ...prev, error: null }));
  }, []);

  const setError = useCallback((message: string) => {
    setData((prev) => ({ ...prev, error: message, state: 'idle' }));
  }, []);

  /**
   * Send a query to the RAG backend and handle the response.
   * Returns the spoken answer for the avatar to speak.
   */
  const sendQuery = useCallback(async (query: string): Promise<string | null> => {
    setData((prev) => ({
      ...prev,
      state: 'processing',
      isLoading: true,
      error: null,
    }));

    try {
      // Add user message to history
      const updatedHistory: Message[] = [
        ...data.history,
        { role: 'user', content: query },
      ];

      const result = await queryRAG(query, updatedHistory);

      // Add assistant response to history
      const finalHistory: Message[] = [
        ...updatedHistory,
        { role: 'assistant', content: result.spoken_answer },
      ];

      setData((prev) => ({
        ...prev,
        history: finalHistory,
        citations: result.citations,
        council: result.council || null,
        isLoading: false,
        state: 'speaking',
      }));

      return result.spoken_answer;
    } catch (err) {
      let errorMessage = 'Something went wrong. Please try again.';

      if (err instanceof Error) {
        if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          errorMessage = "I'm having trouble connecting to the server. Please check your internet connection.";
        } else if (err.message.toLowerCase().includes('timeout')) {
          errorMessage = "The server is taking too long to respond. Let's try that again.";
        } else {
          // Avoid leaking obscure parser errors or backend stack traces
          console.error('[RAG Query Error]:', err.message);
          errorMessage = "I couldn't process that request right now. Could you rephrase?";
        }
      }

      setData((prev) => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
        state: 'idle',
      }));

      return null;
    }
  }, [data.history]);

  const resetConversation = useCallback(() => {
    setData({
      state: 'idle',
      history: [],
      citations: [],
      council: null,
      error: null,
      isLoading: false,
    });
  }, []);

  return {
    ...data,
    setState,
    sendQuery,
    clearError,
    setError,
    resetConversation,
  };
}
