"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Search,
  Clock,
  PanelLeftClose,
  PanelLeftOpen,
  Type,
  Image as ImageIcon,
  Crop,
  Video,
  Smartphone,
  Bot,
  Save,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

import { DraggableSidebarItem } from "./DraggableSidebarItem";
import { useFlowStore } from "~/store/flowStore";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { useAuth } from "@clerk/nextjs";

/**
 * Configuration for available tool items in the sidebar.
 * Simplifies adding new tools by defining them in a central array.
 */
const TOOL_ITEMS = [
  {
    id: "text",
    label: "Text",
    icon: Type,
    type: "text",
  },
  {
    id: "upload-image",
    label: "Upload Image",
    icon: ImageIcon,
    type: "upload-image",
  },
  {
    id: "crop-image",
    label: "Crop Image",
    icon: Crop,
    type: "crop-image",
  },
  {
    id: "upload-video",
    label: "Upload Video",
    icon: Video,
    type: "upload-video",
  },
  {
    id: "extract-frame",
    label: "Extract Frame",
    icon: Smartphone,
    type: "extract-frame",
  },
  {
    id: "run-llm",
    label: "Run LLM",
    icon: Bot,
    type: "run-llm",
  },
];

/**
 * LeftSidebar Component
 * Displays a collapsible sidebar with search and quick access tools.
 * Tools can be dragged onto the canvas.
 */
export function LeftSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [activePanel, setActivePanel] = useState<
    "search" | "quick-access" | null
  >(null);

  const { nodes, edges } = useFlowStore();
  const saveMutation = api.workflow.save.useMutation();
  const utils = api.useUtils();
  const { isSignedIn } = useAuth();

  const toggleSidebar = () => {
    if (!isSignedIn) {
      toast.error("Sign in required", { description: "You must be logged in to access the toolkit." });
      return;
    }
    setIsCollapsed(!isCollapsed);
    if (!isCollapsed) {
      setActivePanel(null);
    }
  };

  const handlePanelClick = (panel: "search" | "quick-access") => {
    if (!isSignedIn) {
      toast.error("Sign in required", { description: "You must be logged in to access the toolkit." });
      return;
    }
    
    if (isCollapsed) {
      setIsCollapsed(false);
      setActivePanel(panel);
    } else if (activePanel === panel) {
      setIsCollapsed(true);
      setActivePanel(null);
    } else {
      setActivePanel(panel);
    }
  };

  const handleSave = () => {
    // Attempt to parse workflow ID from URL
    const pathSegments = window.location.pathname.split("/");
    const workflowId = pathSegments[pathSegments.length - 1]; // /workflow/[id]

    if (!workflowId || workflowId === "workflow") {
      toast.error("Could not determine Workflow ID to save to.");
      return;
    }

    // Prepare definition payload
    const definition = {
      nodes,
      edges,
    };

    toast.loading("Saving workflow...");

    saveMutation.mutate(
      {
        id: workflowId,
        definition: definition,
      },
      {
        onSuccess: () => {
          toast.dismiss();
          toast.success("Workflow saved successfully!");
          utils.workflow.getById.invalidate({ id: workflowId });
        },
        onError: (err) => {
          toast.dismiss();
          console.error(err);
          toast.error("Failed to save workflow.");
        },
      },
    );
  };

  return (
    <aside
      className={cn(
        "relative z-20 flex flex-col border-r border-white/10 bg-[#0A0A0A] transition-all duration-300 ease-in-out",
        isCollapsed ? "w-16" : "w-80",
      )}
    >
      {/* Top Section: App Logo */}
      <div className="flex h-16 items-center justify-center border-b border-white/10 py-4">
        <div className="relative size-8">
          <Image
            src="/weavy-ai.png"
            alt="Weavy AI"
            fill
            className="object-contain"
          />
        </div>
      </div>

      {/* Main Navigation */}
      <div
        className={cn(
          "flex flex-col gap-4 py-4",
          isCollapsed ? "items-center px-0" : "px-3",
        )}
      >
        {/* Search Button */}
        <Button
          variant="ghost"
          size={isCollapsed ? "icon" : "default"}
          className={cn(
            "text-gray-400 hover:bg-white/5 hover:text-white",
            activePanel === "search" && "bg-white/10 text-white",
            !isCollapsed && "w-full justify-start px-3",
          )}
          onClick={() => handlePanelClick("search")}
        >
          <Search className="h-5 w-5" />
          {!isCollapsed && <span className="ml-3">Search</span>}
        </Button>

        {/* Quick Access Button */}
        <Button
          variant="ghost"
          size={isCollapsed ? "icon" : "default"}
          className={cn(
            "text-gray-400 hover:bg-white/5 hover:text-white",
            activePanel === "quick-access" && "bg-white/10 text-white",
            !isCollapsed && "w-full justify-start px-3",
          )}
          onClick={() => handlePanelClick("quick-access")}
        >
          <Clock className="h-5 w-5" />
          {!isCollapsed && <span className="ml-3">Quick Access</span>}
        </Button>

        {/* Save Button */}
        <Button
          variant="ghost"
          size={isCollapsed ? "icon" : "default"}
          className={cn(
            "mt-auto text-gray-400 hover:bg-white/5 hover:text-white",
            !isCollapsed && "w-full justify-start px-3",
          )}
          onClick={handleSave}
          disabled={saveMutation.isPending}
        >
          <Save className="h-5 w-5" />
          {!isCollapsed && <span className="ml-3">Save</span>}
        </Button>
      </div>

      {/* Content Panel Area (Only visible when expanded) */}
      {!isCollapsed && activePanel && (
        <div className="animate-in fade-in flex-1 overflow-y-auto px-4 py-2 duration-300">
          <div className="mb-6">
            <Input
              placeholder="Search..."
              className="border-white/10 bg-white/5 text-white focus-visible:ring-indigo-500"
            />
          </div>

          {activePanel === "quick-access" && (
            <div>
              <h3 className="mb-4 text-xs font-semibold tracking-wider text-gray-500 uppercase">
                Quick Access
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {TOOL_ITEMS.map((tool) => (
                  <DraggableSidebarItem
                    key={tool.id}
                    id={tool.id}
                    label={tool.label}
                    icon={tool.icon}
                    type={tool.type}
                    onClick={() => {}}
                  />
                ))}
              </div>
            </div>
          )}
          {/* Placeholder for Search results or other content */}
          {activePanel === "search" && (
            <div className="mt-10 text-center text-sm text-gray-500">
              No results found.
            </div>
          )}
        </div>
      )}

      {/* Toggle Button at Bottom */}
      <div className="mt-auto border-t border-white/10 p-3">
        <Button
          variant="ghost"
          size={isCollapsed ? "icon" : "default"}
          className={cn(
            "text-gray-500 hover:text-white",
            !isCollapsed && "w-full justify-start px-3",
          )}
          onClick={toggleSidebar}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
          {!isCollapsed && <span className="ml-3">Collapse</span>}
        </Button>
      </div>
    </aside>
  );
}
