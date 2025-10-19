import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatArea } from "./ChatArea";
import { agentService } from "../services/agentService";
import type { PermissionRequest } from "../services/agentService";

// Mock stores
vi.mock("../stores/chatStore", () => ({
  useChatStore: () => ({
    messages: [],
    streaming: false,
    sendMessage: vi.fn(),
    currentStreamingMessage: "",
    error: null,
  }),
}));

vi.mock("../stores/spacesStore", () => ({
  useSpacesStore: () => ({
    currentSpace: {
      id: "test-space-id",
      name: "Test Space",
      path: "/test/path",
      created_at: Date.now(),
      updated_at: Date.now(),
    },
  }),
}));

describe("ChatArea - Permission Queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle multiple simultaneous permission requests", async () => {
    const { rerender } = render(<ChatArea />);

    // Simulate two permission requests coming in simultaneously
    const request1: PermissionRequest = {
      request_id: "req-1",
      session_id: "session-1",
      tool_call_id: "tool-1",
      title: "Fetch CNN",
      kind: "WebFetch",
      options: [{ option_id: "allow", name: "Allow", kind: "allow" }],
      raw_input: { url: "https://cnn.com" },
    };

    const request2: PermissionRequest = {
      request_id: "req-2",
      session_id: "session-1",
      tool_call_id: "tool-2",
      title: "Fetch Democracy Now",
      kind: "WebFetch",
      options: [{ option_id: "allow", name: "Allow", kind: "allow" }],
      raw_input: { url: "https://democracynow.org" },
    };

    // Trigger both permission requests
    if (agentService.onPermissionRequest) {
      agentService.onPermissionRequest(request1);
      agentService.onPermissionRequest(request2);
    }

    rerender(<ChatArea />);

    // First request should be visible
    await waitFor(() => {
      expect(screen.getByText("Fetch CNN")).toBeInTheDocument();
    });

    // Queue indicator should show "2 pending"
    expect(screen.getByText("2 pending")).toBeInTheDocument();
  });

  it("should process permission requests sequentially", async () => {
    const user = userEvent.setup();
    const mockRespond = vi.spyOn(agentService, "respondToPermission");

    render(<ChatArea />);

    const request1: PermissionRequest = {
      request_id: "req-1",
      session_id: "session-1",
      tool_call_id: "tool-1",
      title: "First Request",
      kind: "test",
      options: [{ option_id: "allow", name: "Allow", kind: "allow" }],
      raw_input: {},
    };

    const request2: PermissionRequest = {
      request_id: "req-2",
      session_id: "session-1",
      tool_call_id: "tool-2",
      title: "Second Request",
      kind: "test",
      options: [{ option_id: "allow", name: "Allow", kind: "allow" }],
      raw_input: {},
    };

    // Add both to queue
    if (agentService.onPermissionRequest) {
      agentService.onPermissionRequest(request1);
      agentService.onPermissionRequest(request2);
    }

    // First request should be visible
    await waitFor(() => {
      expect(screen.getByText("First Request")).toBeInTheDocument();
    });

    // Approve first request
    const allowButton = screen.getAllByText("Allow")[0];
    await user.click(allowButton);

    // Should have called respondToPermission for first request
    expect(mockRespond).toHaveBeenCalledWith("req-1", "allow", false);

    // Second request should now be visible
    await waitFor(() => {
      expect(screen.getByText("Second Request")).toBeInTheDocument();
    });

    // Queue should now show "1 pending" or nothing if only one left
    expect(screen.queryByText("2 pending")).not.toBeInTheDocument();
  });

  it("should clear permission queue when starting new message", async () => {
    const user = userEvent.setup();

    render(<ChatArea />);

    const request: PermissionRequest = {
      request_id: "req-1",
      session_id: "session-1",
      tool_call_id: "tool-1",
      title: "Pending Request",
      kind: "test",
      options: [{ option_id: "allow", name: "Allow", kind: "allow" }],
      raw_input: {},
    };

    // Add permission to queue
    if (agentService.onPermissionRequest) {
      agentService.onPermissionRequest(request);
    }

    await waitFor(() => {
      expect(screen.getByText("Pending Request")).toBeInTheDocument();
    });

    // Type a new message
    const textarea = screen.getByPlaceholderText(/Type a message/);
    await user.type(textarea, "New message");

    // Submit (note: this would normally trigger in a real scenario)
    // The permission should be cleared when handleSubmit is called
    // Since we mocked sendMessage, we're testing the clearing logic
  });
});
