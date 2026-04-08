"use client";

import {
  Handle,
  Position,
  useReactFlow,
  useNodeConnections,
} from "@xyflow/react";
import type { Node, NodeProps, Connection, Edge } from "@xyflow/react";
import { Bot, Image as ImageIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { useFlowStore } from "~/store/flowStore";
import { toast } from "sonner";
import { api } from "~/trpc/react";

type RunLLMNodeData = {
  label?: string;
  result?: string;
  systemUsed?: string;
  promptUsed?: string;
  imageUsed?: string; // Storing the image URL used
};

type MyNode = Node<RunLLMNodeData>;

export function RunLLMNode({ data, selected, id }: NodeProps<MyNode>) {
  const { getEdges, getNodes } = useReactFlow();

  // Track connections to enable/disable handles or show status
  const systemConnections = useNodeConnections({
    handleType: "target",
    handleId: "system",
  });
  const promptConnections = useNodeConnections({
    handleType: "target",
    handleId: "prompt",
  });
  const imageConnections = useNodeConnections({
    handleType: "target",
    handleId: "image1",
  });

  const { setExecutionState, executionState, updateNodeData, nodeData } =
    useFlowStore();
  const isRunning = executionState[id] === "running";

  // Merge initial data (props) with live store data
  const currentStoreData = (nodeData[id] ?? {}) as Partial<RunLLMNodeData>;
  const currentData = { ...data, ...currentStoreData };
  const { result, systemUsed, promptUsed, imageUsed } = currentData;

  const runLLMMutation = api.workflow.runLLM.useMutation();
  const apiUtils = api.useUtils();

  // Helper safely extract text string
  const safeGetText = (obj: unknown): string => {
    if (typeof obj === "object" && obj !== null) {
      const data = obj as Record<string, unknown>;
      // Check for 'text' (TextNode)
      if ("text" in data && typeof data.text === "string") {
        return data.text;
      }
      // Check for 'result' (RunLLMNode)
      if ("result" in data && typeof data.result === "string") {
        return data.result;
      }
    }
    return "";
  };

  // derived state for checks
  const promptConnection = promptConnections?.[0];
  const promptSourceId = promptConnection?.source;

  let promptText = "";
  if (promptSourceId) {
    // 1. Live Data
    const liveData = nodeData[promptSourceId];
    if (liveData) {
      promptText = safeGetText(liveData);
    }
    // 2. Static Data (fallback if live data is empty/missing, though live data usually supercedes)
    if (!promptText) {
      const sourceNode = getNodes().find((n) => n.id === promptSourceId);
      if (sourceNode?.data) {
        promptText = safeGetText(sourceNode.data);
      }
    }
  }

  const isPromptValid = promptText && promptText.trim().length > 0;

  const validateInput = (
    connection: Connection | Edge,
    expectedSourceType: "text" | "image" | "result",
  ) => {
    // connection.sourceHandle is the ID of the handle on the source node
    const sourceHandleId = connection.sourceHandle;

    if (expectedSourceType === "image") {
      // Only allow connection if the source handle is explicitly an image output
      // We assume nodes outputting images use id="image"
      if (sourceHandleId === "image") return true;
      return false;
    }

    if (expectedSourceType === "text") {
      // Allow text inputs from text-like handles
      // We assume nodes outputting text use id="text" (TextNode) or "result" (RunLLMNode) or "prompt" (RunLLMNode pass-through)
      // Explicitly ban "image" handle
      if (sourceHandleId === "image") return false;
      return true;
    }

    if (expectedSourceType === "result") {
      // Allow result inputs from result-like handles
      // We assume nodes outputting results use id="result"
      if (sourceHandleId === "result") return true;
      return false;
    }

    return true;
  };

  const handleRun = async () => {
    const edges = getEdges();
    const nodes = getNodes();

    // Gather inputs from connected nodes
    const getSourceData = (handleId: string) => {
      const edge = edges.find(
        (e) => e.target === id && e.targetHandle === handleId,
      );
      if (!edge) return null;

      // Try to get data from global store first (live updates)
      if (nodeData[edge.source]) {
        return nodeData[edge.source];
      }

      // Fallback to ReactFlow node data
      const sourceNode = nodes.find((n) => n.id === edge.source);
      return sourceNode?.data;
    };

    const systemData = getSourceData("system");
    const promptData = getSourceData("prompt");
    const imageData = getSourceData("image1");

    const safeGetImage = (obj: unknown): string | undefined => {
      if (typeof obj === "object" && obj !== null) {
        // Check for imageUrl (new convention) or image (legacy)
        if ("imageUrl" in obj) {
          const val = (obj as Record<string, unknown>).imageUrl;
          return typeof val === "string" ? val : undefined;
        }
        if ("image" in obj) {
          const val = (obj as Record<string, unknown>).image;
          return typeof val === "string" ? val : undefined;
        }
      }
      return undefined;
    };

    const systemText = safeGetText(systemData); // reuse hoisted helper if preferred, or keep logic. 
    // Actually simpler to just use local variables or reuse the hoisted one.
    // promptData might be slightly different object reference but logic is same.
    const promptTextVal = safeGetText(promptData);
    const imageUrl = safeGetImage(imageData);

    setExecutionState(id, "running");

    // Update the node data with what we are about to allow user inspection
    updateNodeData(id, {
      systemUsed: systemText,
      promptUsed: promptTextVal,
      imageUsed: imageUrl,
      result: undefined, // clear previous result
    });

    // Validation
    if (imageUrl) {
      // Simple check for URL extension
      // User requirements: "validation will be easy as input will be url ending with .jpg..."
      const lowerUrl = imageUrl.toLowerCase();
      const isDataUrl = lowerUrl.startsWith("data:image/");

      // It might be a cloudinary url too now, so let's allow http(s)
      const isHttp = lowerUrl.startsWith("http");

      if (!isDataUrl && !isHttp) {
        toast.error("Invalid Image Input", {
          description: "Input must be a Base64 Data URL or a valid Image URL.",
        });
        setExecutionState(id, "failed");
        return;
      }
    }

    try {
      // 1. Trigger the background execution
      const runResult = await runLLMMutation.mutateAsync({
        system: systemText,
        prompt: promptTextVal,
        imageURL: imageUrl,
      });

      const { executionId } = runResult as { executionId?: string };

      if (!executionId) {
        throw new Error("Failed to start background execution.");
      }

      // 2. Poll for results 
      let aiText = "";
      let executionStatus = "PENDING";
      
      while (executionStatus === "PENDING") {
        await new Promise((resolve) => setTimeout(resolve, 1500)); // poll every 1.5s
        const execState = await apiUtils.workflow.getExecution.fetch({ id: executionId });
        
        if (execState.status === "COMPLETED") {
          executionStatus = "COMPLETED";
          aiText = execState.result || "";
        } else if (execState.status === "FAILED") {
          throw new Error(execState.result ?? "Background task failed to execute.");
        }
      }

      // 3. Resolve the interface
      if (!aiText) {
        console.warn("AI returned empty result", executionId);
        toast.error("AI response generation failed: Recieved empty response", {
          description: "Please try again or check your prompt.",
        });
        setExecutionState(id, "failed");
        return;
      }

      updateNodeData(id, {
        result: aiText,
        // Keeping inputs in data so they persist in UI
        systemUsed: systemText,
        promptUsed: promptTextVal,
        imageUsed: imageUrl,
      });
      setExecutionState(id, "completed");
      toast.success("AI Generation Complete");
    } catch (error) {
      console.error("RunLLM execution error:", error);
      let message = "Unknown error occurred";
      if (error instanceof Error) message = error.message;

      toast.error("AI Generation Failed", {
        description: message,
      });
      setExecutionState(id, "failed");
    }
  };

  return (
    <div
      className={cn(
        "group relative flex w-80 flex-col rounded-xl border-2 bg-[#1A1A1A] text-white shadow-2xl transition-all",
        selected
          ? "border-[#E0FC00] shadow-[#E0FC00]/20"
          : "border-white/10 hover:border-white/20",
      )}
    >
      {/* Header */}
      <div className="flex h-10 items-center justify-between rounded-t-xl border-b border-white/5 bg-[#222] px-4 py-2">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-[#E0FC00]" />
          <span className="text-xs font-semibold tracking-wider text-gray-400 uppercase">
            {data.label ?? "Run LLM"}
          </span>
        </div>
        <button
          onClick={handleRun}
          disabled={isRunning || !isPromptValid}
          className={cn(
            "rounded px-2 py-1 text-[10px] font-bold uppercase transition-colors",
            isRunning || !isPromptValid
              ? "cursor-not-allowed bg-gray-700 text-gray-400"
              : "bg-[#E0FC00] text-black hover:bg-[#cbe600]",
          )}
          title={!isPromptValid ? "Please connect a valid text prompt" : "Run AI"}
        >
          {isRunning ? "Running..." : "Run"}
        </button>
      </div>

      {/* Main Body */}
      <div className="relative flex min-h-[120px] flex-col gap-3 p-4">
        {/* Input Handles */}
        <div className="absolute top-4 -left-3 flex flex-col gap-6">
          <Handle
            type="target"
            position={Position.Left}
            id="prompt"
            className="!relative !left-0 !h-3 !w-3 !border-2 !border-[#1A1A1A] !bg-gray-500"
            isValidConnection={(c) => validateInput(c, "text")}
            isConnectable={promptConnections.length === 0}
            title="User Prompt"
          />
          <Handle
            type="target"
            position={Position.Left}
            id="system"
            className="!relative !left-0 !h-3 !w-3 !border-2 !border-[#1A1A1A] !bg-gray-500"
            isValidConnection={(c) => validateInput(c, "text")}
            isConnectable={systemConnections.length === 0}
            title="System Prompt"
          />
          <Handle
            type="target"
            position={Position.Left}
            id="image1" // Kept as image1 based on previous code, mapped to image payload
            className="!relative !left-0 !h-3 !w-3 !border-2 !border-[#1A1A1A] !bg-indigo-500"
            isValidConnection={(c) => validateInput(c, "image")}
            isConnectable={imageConnections.length === 0}
            title="Image"
          />
        </div>

        {/* Info Section (System & User Used) */}
        {(!!systemUsed || !!promptUsed || !!imageUsed) && (
          <div className="mb-2 flex flex-col gap-2 rounded bg-white/5 p-2 text-xs">
            {systemUsed && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-gray-500 uppercase">
                  System
                </span>
                <span className="line-clamp-2 text-gray-300" title={systemUsed}>
                  {systemUsed}
                </span>
              </div>
            )}
            {promptUsed && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-gray-500 uppercase">
                  User
                </span>
                <span className="line-clamp-2 text-gray-300" title={promptUsed}>
                  {promptUsed}
                </span>
              </div>
            )}
            {imageUsed && (
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1">
                  <ImageIcon className="h-3 w-3 text-indigo-400" />
                  <span className="text-[10px] font-semibold text-gray-500 uppercase">
                    Image
                  </span>
                </div>
                <a
                  href={imageUsed}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="line-clamp-1 break-all text-indigo-300 underline hover:text-indigo-200"
                  title={imageUsed}
                >
                  {imageUsed}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Result Area */}
        <div
          className={cn(
            "h-full w-full rounded bg-black/50 p-3 font-mono text-sm leading-relaxed",
            result ? "text-gray-300" : "text-gray-600 italic",
          )}
        >
          {result ?? "AI response"}
        </div>
      </div>

      {/* Footer / Output Handle */}
      <div className="relative flex items-center justify-end rounded-b-xl border-t border-white/5 bg-[#222] p-2">
        <span className="mr-2 text-[10px] text-gray-500">result</span>
        <Handle
          type="source"
          position={Position.Right}
          id="text"
          className="!h-3 !w-3 !border-2 !border-[#1A1A1A] !bg-[#E0FC00]"
        />
      </div>
    </div>
  );
}
