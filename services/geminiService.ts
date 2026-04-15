
// services/geminiService.ts

import { GoogleGenAI } from "@google/genai";

// FIX: Initialized GoogleGenAI using a named parameter with process.env.API_KEY directly, as per coding guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * 주어진 프롬프트를 사용하여 Gemini AI 모델로부터 분석 결과를 비동기적으로 가져옵니다.
 * @param prompt AI 모델에 전달할 상세한 질문 또는 분석 요청 문자열입니다.
 * @returns AI가 생성한 텍스트 분석 결과 또는 오류 메시지를 담은 문자열을 반환합니다.
 */
export const getAiAnalysis = async (prompt: string): Promise<string> => {
  try {
    // FIX: Using the recommended model 'gemini-3-flash-preview' for basic text tasks as per guidelines.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    
    // FIX: Accessing generated text via the .text property directly on the GenerateContentResponse object.
    return response.text || "AI 모델로부터 응답을 받지 못했습니다.";
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return "AI 모델을 호출하는 중 오류가 발생했습니다. 네트워크 연결 상태나 API 설정을 확인해 주세요.";
  }
};
