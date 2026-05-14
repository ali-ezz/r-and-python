import { useState, useRef, useEffect } from "react";
import { CreateMLCEngine, type InitProgressReport, type ChatCompletionMessageParam } from "@mlc-ai/web-llm";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ModelOption {
  id: string;
  name: string;
  provider: "local" | "huggingface";
  size?: string;
  description?: string;
  arabicDesc?: string;
  apiEndpoint?: string; // For HF chat completions
}

const MODELS: ModelOption[] = [
  // Hugging Face - Free Inference API (working models)
  {
    id: "hf/mistralai/Mistral-7B-Instruct-v0.3",
    name: "Mistral 7B v0.3",
    provider: "huggingface",
    description: "Free via HF Inference API",
    apiEndpoint: "https://router.huggingface.co/v1/chat/completions",
  },
  {
    id: "hf/meta-llama/Llama-3.1-8B-Instruct",
    name: "Llama 3.1 8B",
    provider: "huggingface",
    description: "Free via HF Inference API",
    apiEndpoint: "https://router.huggingface.co/v1/chat/completions",
  },
  {
    id: "hf/Qwen/Qwen2.5-7B-Instruct",
    name: "Qwen 2.5 7B",
    provider: "huggingface",
    description: "Free via HF Inference API",
    apiEndpoint: "https://router.huggingface.co/v1/chat/completions",
  },
  {
    id: "hf/google/gemma-2-2b-it",
    name: "Gemma 2 2B",
    provider: "huggingface",
    description: "Free via HF Inference API",
    apiEndpoint: "https://router.huggingface.co/v1/chat/completions",
  },
  {
    id: "hf/HuggingFaceH4/zephyr-7b-beta",
    name: "Zephyr 7B Beta",
    provider: "huggingface",
    description: "Free via HF Inference API",
    apiEndpoint: "https://router.huggingface.co/v1/chat/completions",
  },
  // Local WebLLM models (require WebGPU)
  {
    id: "SmolLM2-360M-Instruct-q4f16_1-MLC",
    name: "SmolLM2 360M (Local)",
    provider: "local",
    size: "~376MB",
    arabicDesc: "حجمه لا يُقارن، تحميله شبه فوري، مثالي للتطبيقات الخفيفة.",
  },
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    name: "Llama 3.2 1B (Local)",
    provider: "local",
    size: "~879MB",
    arabicDesc: "الأصغر والأسرع، خيار ممتاز للتجارب السريعة.",
  },
  {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    name: "Qwen 2.5 1.5B (Local)",
    provider: "local",
    size: "~1.28GB",
    arabicDesc: "أداء قوي جداً في المهام العربية مقارنة بحجمه.",
  },
  {
    id: "Phi-3.5-mini-instruct-q4f16_1-MLC",
    name: "Phi 3.5 Mini (Local)",
    provider: "local",
    size: "~1.5GB",
    arabicDesc: "نموذج قوي من مايكروسوفت، أداء متوازن.",
  },
  {
    id: "Qwen2.5-3B-Instruct-q4f16_1-MLC",
    name: "Qwen 2.5 3B (Local)",
    provider: "local",
    size: "~1.7GB",
    arabicDesc: "نقلة نوعية في الأداء، خيارك إذا كانت الأولوية للذكاء.",
  },
  {
    id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    name: "Llama 3.2 3B (Local)",
    provider: "local",
    size: "~2.26GB",
    arabicDesc: "نموذج ممتاز من ميتا، أداؤه رائع في المهام العامة.",
  },
];

const HF_ROUTER_URL = "https://router.huggingface.co/v1/chat/completions";

interface Props {
  isDark: boolean;
}

export default function AIChat({ isDark }: Props) {
  const [webGPUSupported, setWebGPUSupported] = useState<boolean | null>(null);
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const engineRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Detect WebGPU support on mount
  useEffect(() => {
    const hasWebGPU = !!(navigator as any).gpu;
    setWebGPUSupported(hasWebGPU);
    // Default to first HF model
    setSelectedModel(MODELS[0].id);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getSelectedModelInfo = () => MODELS.find((m) => m.id === selectedModel);

  const loadModel = async () => {
    const model = getSelectedModelInfo();
    if (!model) return;

    setIsLoading(true);
    setError(null);
    setProgress(0);

    if (model.provider === "huggingface") {
      setProgressText("Connecting to Hugging Face Router...");
      setProgress(50);

      try {
        // Test the router endpoint
        const res = await fetch(HF_ROUTER_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Wait-For-Model": "true",
          },
          body: JSON.stringify({
            model: model.id.replace("hf/", ""),
            messages: [{ role: "user", content: "Hi" }],
            max_tokens: 1,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || `HTTP ${res.status}: ${res.statusText}`);
        }

        // Check if response has choices (successful)
        const data = await res.json();
        if (!data.choices || data.choices.length === 0) {
          throw new Error("Model returned empty response");
        }

        setProgress(100);
        setIsLoaded(true);
        setMessages([
          {
            role: "assistant",
            content: `Hello! I'm ${model.name}, powered by Hugging Face Inference API (free tier). How can I help you today?`,
          },
        ]);
      } catch (err: any) {
        const errorMsg = err.message || "Failed to connect to Hugging Face";
        if (errorMsg.includes("410") || errorMsg.includes("Gone")) {
          setError("This model is no longer available on the free tier. Try selecting a different model.");
        } else if (errorMsg.includes("503")) {
          setError("Model is loading on HF servers. Please wait a minute and try again.");
        } else if (errorMsg.includes("429")) {
          setError("Rate limit exceeded. Please wait a moment before trying again.");
        } else {
          setError(errorMsg);
        }
      } finally {
        setIsLoading(false);
      }
    } else {
      // Local WebLLM model
      setProgressText("Initializing...");
      setProgress(0);

      if (!webGPUSupported) {
        setError("WebGPU is not supported in your browser. Please use a Hugging Face model instead, or try Chrome 113+ with a compatible GPU.");
        setIsLoading(false);
        return;
      }

      try {
        const engine = await CreateMLCEngine(model.id, {
          initProgressCallback: (progress: InitProgressReport) => {
            const pct = Math.round(progress.progress * 100);
            setProgress(pct);
            if (pct < 30) setProgressText("Downloading model...");
            else if (pct < 80) setProgressText("Loading weights...");
            else setProgressText("Finalizing...");
          },
        });

        engineRef.current = engine;
        setIsLoaded(true);
        setMessages([
          {
            role: "assistant",
            content: `Hello! I'm ${model.name}, running locally in your browser via WebLLM. How can I help you today?`,
          },
        ]);
      } catch (err: any) {
        if (err.message?.includes("WebGPU") || err.message?.includes("adapter")) {
          setError("WebGPU is not available. Please use Chrome/Edge with a compatible GPU, or switch to a Hugging Face model.");
        } else {
          setError(err.message || "Failed to load local model");
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !isLoaded || isGenerating) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsGenerating(true);

    try {
      const model = getSelectedModelInfo();

      if (model?.provider === "huggingface") {
        const assistantMessage: Message = { role: "assistant", content: "" };
        setMessages((prev) => [...prev, assistantMessage]);

        const res = await fetch(HF_ROUTER_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Wait-For-Model": "true",
          },
          body: JSON.stringify({
            model: model.id.replace("hf/", ""),
            messages: [
              { role: "system", content: "You are 5*A AI, a helpful assistant. Be concise and accurate." },
              ...newMessages.map((m) => ({ role: m.role, content: m.content })),
            ],
            max_tokens: 2048,
            temperature: 0.7,
            stream: true,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || `HTTP ${res.status}`);
        }

        // Handle streaming response
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter((line) => line.trim() && line !== "data: [DONE]");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const json = JSON.parse(line.slice(6));
                  const delta = json.choices?.[0]?.delta?.content || "";
                  accumulated += delta;
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { ...updated[updated.length - 1], content: accumulated };
                    return updated;
                  });
                } catch {}
              }
            }
          }
        }
      } else {
        // Local WebLLM streaming
        const assistantMessage: Message = { role: "assistant", content: "" };
        setMessages((prev) => [...prev, assistantMessage]);

        const reply = await engineRef.current.chat.completions.create({
          stream: true,
          messages: [
            {
              role: "system",
              content: "You are 5*A AI, a helpful and knowledgeable assistant. Be concise and accurate.",
            },
            ...newMessages.map((m) => ({ role: m.role, content: m.content })) as ChatCompletionMessageParam[],
          ],
          max_tokens: 2048,
          temperature: 0.7,
        });

        let accumulated = "";
        for await (const chunk of reply) {
          const delta = chunk.choices[0]?.delta?.content || "";
          accumulated += delta;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { ...updated[updated.length - 1], content: accumulated };
            return updated;
          });
        }
      }
    } catch (err: any) {
      const errorMsg = err.message || "Generation failed";
      if (errorMsg.includes("410") || errorMsg.includes("Gone")) {
        setError("This model is no longer available. Please select a different model.");
      } else if (errorMsg.includes("503")) {
        setError("Model is loading on HF servers. Please wait and try again.");
      } else if (errorMsg.includes("429")) {
        setError("Rate limit exceeded. Please wait before trying again.");
      } else {
        setError(errorMsg);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setInput("");
    setError(null);
  };

  const unloadModel = () => {
    if (engineRef.current && getSelectedModelInfo()?.provider === "local") {
      engineRef.current.unload();
      engineRef.current = null;
    }
    setIsLoaded(false);
    setMessages([]);
    setError(null);
  };

  // Styles
  const bgMain = isDark ? "bg-[#0f0f0f]" : "bg-[#fafafa]";
  const bgCard = isDark ? "bg-[#1a1a1a]" : "bg-white";
  const border = isDark ? "border-[#222]" : "border-[#eee]";
  const textPrimary = isDark ? "text-white" : "text-[#111]";
  const textSecondary = isDark ? "text-[#888]" : "text-[#666]";
  const textMuted = isDark ? "text-[#555]" : "text-[#999]";

  const selectedModelInfo = getSelectedModelInfo();

  return (
    <div className={`flex flex-col h-[calc(100vh-120px)] ${bgMain} rounded-2xl border ${border} overflow-hidden`}>
      {/* Header */}
      <div className={`px-4 sm:px-6 py-3 border-b ${border} ${bgCard}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? "bg-[#222]" : "bg-black"}`}>
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <div>
              <h2 className={`text-sm font-semibold ${textPrimary}`}>AI Chat</h2>
              <p className={`text-[10px] ${textMuted}`}>
                {isLoaded
                  ? `${selectedModelInfo?.name} ${selectedModelInfo?.provider === "huggingface" ? "(HF Free)" : "(Local)"}`
                  : "Select a model to start"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isLoaded && (
              <button
                onClick={clearChat}
                className={`px-3 py-1.5 text-[10px] tracking-wider uppercase rounded-lg transition-colors ${
                  isDark ? "text-[#666] hover:text-white hover:bg-[#222]" : "text-[#999] hover:text-black hover:bg-[#f0f0f0]"
                }`}
              >
                Clear
              </button>
            )}
            {isLoaded && (
              <button
                onClick={unloadModel}
                className={`px-3 py-1.5 text-[10px] tracking-wider uppercase rounded-lg transition-colors ${
                  isDark ? "text-[#666] hover:text-red-400 hover:bg-[#222]" : "text-[#999] hover:text-red-500 hover:bg-[#fee]"
                }`}
              >
                Unload
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Model Selection / Progress */}
      {!isLoaded && (
        <div className={`p-4 border-b ${border} ${bgCard}`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={isLoading}
              className={`flex-1 w-full sm:w-auto px-3 py-2 text-sm rounded-lg border outline-none ${
                isDark
                  ? "bg-[#111] border-[#222] text-white disabled:opacity-50"
                  : "bg-[#fafafa] border-[#ddd] text-black disabled:opacity-50"
              }`}
            >
              <optgroup label="Hugging Face (Free, No GPU Required)">
                {MODELS.filter((m) => m.provider === "huggingface").map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.description}
                  </option>
                ))}
              </optgroup>
              {webGPUSupported !== false && (
                <optgroup label="Local (Requires WebGPU)">
                  {MODELS.filter((m) => m.provider === "local").map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.size}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <button
              onClick={loadModel}
              disabled={isLoading}
              className={`w-full sm:w-auto px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                isLoading
                  ? isDark
                    ? "bg-[#222] text-[#555] cursor-not-allowed"
                    : "bg-[#eee] text-[#999] cursor-not-allowed"
                  : isDark
                  ? "bg-white text-black hover:bg-[#e0e0e0]"
                  : "bg-black text-white hover:bg-[#333]"
              }`}
            >
              {isLoading ? "Loading..." : selectedModelInfo?.provider === "huggingface" ? "Connect" : "Load Model"}
            </button>
          </div>

          {isLoading && (
            <div className="mt-3">
              <div className={`h-2 rounded-full overflow-hidden ${isDark ? "bg-[#222]" : "bg-[#eee]"}`}>
                <div
                  className={`h-full rounded-full transition-all duration-300 ${isDark ? "bg-white" : "bg-black"}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className={`text-[10px] ${textMuted}`}>{progressText}</span>
                <span className={`text-[10px] font-mono ${textSecondary}`}>{progress}%</span>
              </div>
            </div>
          )}

          {error && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${isDark ? "bg-red-900/20 text-red-400" : "bg-red-50 text-red-600"}`}>
              {error}
            </div>
          )}

          {!isLoaded && webGPUSupported === false && (
            <div className={`mt-3 p-3 rounded-lg text-xs border ${isDark ? "bg-amber-900/20 border-amber-800/30 text-amber-400" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
              <p className="font-semibold mb-1">WebGPU not supported</p>
              <p>Local models require WebGPU. Use <strong>Hugging Face models</strong> which run on remote servers — no GPU needed.</p>
            </div>
          )}

          {selectedModelInfo?.provider === "huggingface" && (
            <div className={`mt-3 p-3 rounded-lg text-xs ${isDark ? "bg-[#111] text-[#666]" : "bg-[#f5f5f5] text-[#999]"}`}>
              <p>Free tier via Hugging Face Inference Router. First request may take 30-60s while the model loads. Rate limits apply.</p>
            </div>
          )}

          {selectedModelInfo?.provider === "local" && (
            <div className={`mt-3 p-3 rounded-lg text-xs ${isDark ? "bg-[#111] text-[#666]" : "bg-[#f5f5f5] text-[#999]"}`}>
              <p className="mb-2">Models run locally via WebLLM. First load downloads the model which is then cached. Requires WebGPU.</p>
              {selectedModelInfo.arabicDesc && (
                <p className={`pt-2 border-t ${isDark ? "border-[#222]" : "border-[#ddd]"}`} dir="rtl">
                  {selectedModelInfo.arabicDesc}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
        {messages.length === 0 && isLoaded && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${isDark ? "bg-[#1a1a1a]" : "bg-[#f0f0f0]"}`}>
              <svg className={`w-8 h-8 ${textMuted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className={`text-sm ${textSecondary}`}>Start a conversation</p>
            <p className={`text-xs mt-1 ${textMuted}`}>
              {selectedModelInfo?.provider === "huggingface" ? "Powered by Hugging Face (Free)" : "Running locally via WebLLM"}
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] sm:max-w-[70%] px-4 py-3 rounded-2xl ${
                msg.role === "user"
                  ? isDark ? "bg-white text-black rounded-br-md" : "bg-black text-white rounded-br-md"
                  : isDark ? "bg-[#1a1a1a] text-[#e0e0e0] rounded-bl-md" : "bg-[#f0f0f0] text-[#111] rounded-bl-md"
              }`}
            >
              <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                {msg.content}
                {msg.role === "assistant" && i === messages.length - 1 && isGenerating && (
                  <span className="inline-block w-2 h-4 ml-1 animate-pulse bg-current opacity-50" />
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className={`px-4 sm:px-6 py-3 border-t ${border} ${bgCard}`}>
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isLoaded ? "Type a message..." : "Load a model first"}
            disabled={!isLoaded || isGenerating}
            rows={1}
            className={`flex-1 px-4 py-3 text-sm rounded-xl border outline-none resize-none disabled:opacity-50 ${
              isDark
                ? "bg-[#111] border-[#222] text-white placeholder:text-[#444] focus:border-[#444]"
                : "bg-[#f5f5f5] border-[#ddd] text-black placeholder:text-[#bbb] focus:border-[#999]"
            }`}
            style={{ minHeight: "44px", maxHeight: "120px" }}
          />
          <button
            onClick={sendMessage}
            disabled={!isLoaded || !input.trim() || isGenerating}
            className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
              !isLoaded || !input.trim() || isGenerating
                ? isDark ? "bg-[#222] text-[#444] cursor-not-allowed" : "bg-[#eee] text-[#bbb] cursor-not-allowed"
                : isDark ? "bg-white text-black hover:bg-[#e0e0e0]" : "bg-black text-white hover:bg-[#333]"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <div className={`mt-2 flex items-center justify-between ${textMuted}`}>
          <p className="text-[10px]">Press Enter to send, Shift+Enter for new line</p>
          {isLoaded && (
            <p className="text-[10px]">{messages.filter((m) => m.role === "user").length} messages</p>
          )}
        </div>
      </div>
    </div>
  );
}
