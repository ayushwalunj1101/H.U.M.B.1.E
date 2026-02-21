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
      const errorMessage =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';

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
    resetConversation,
  };
}
