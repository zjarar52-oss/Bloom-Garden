
import { GoogleGenAI } from "@google/genai";

// Initialize with strictly process.env.API_KEY as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateSupplyQuotes = async () => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "请为一个名为‘情绪补给站’的应用生成4条今日能量文案。时间节点分别为08:00, 11:00, 18:00, 22:00。要求：高能量、温柔、正向、不涉及恋爱词汇（如我爱你、想你等），每条文案附带一个贴切的emoji。以JSON格式返回，包含time, text, emoji三个字段。",
      config: {
        responseMimeType: "application/json"
      }
    });
    // Access text property directly as per guidelines
    return JSON.parse(response.text || '[]');
  } catch (error) {
    console.error("Failed to generate quotes:", error);
    return null;
  }
};
