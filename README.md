# Weavy Clone

A powerful visual workflow builder for AI and media processing tasks.

**Live Demo:** [https://weavy-clone-mauve.vercel.app](https://weavy-clone-mauve.vercel.app)
**Github Link:** [https://github.com/Aryan123-rgb/weavy-clone](https://github.com/Aryan123-rgb/weavy-clone)

## How It Works
This application allows you to build complex workflows in a visual format by connecting different nodes. You can process media, run AI models, and chain outputs from one node to another.

**Key Features:**
*   **Visual Editor:** Drag-and-drop interface powered by React Flow.
*   **AI Integration:** Use LLM nodes to generate text or analyze content (Groq).
*   **Media Processing:** Upload videos/images, crop images, and extract frames from videos.
*   **Background Jobs:** Heavy tasks (like video processing and LLM calls) are handled reliably by **Trigger.dev**.
*   **Authentication:** Secure user management with Clerk.

## Installation

### Prerequisites
*   Node.js & npm
*   PostgreSQL Database
*   Accounts for: [Clerk](https://clerk.com), [Cloudinary](https://cloudinary.com), [Trigger.dev](https://trigger.dev), [Groq](https://groq.com)

### Steps

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Aryan123-rgb/weavy-clone
    cd weavy-clone
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up Environment Variables:**
    Create a `.env` file in the root directory and add the following keys:
    ```env
    # Database
    DATABASE_URL="postgresql://..."

    # Auth (Clerk)
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
    CLERK_SECRET_KEY=...

    # Cloudinary
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
    NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=...
    CLOUDINARY_API_KEY=...
    CLOUDINARY_API_SECRET=...

    # AI
    GROQ_API_KEY=...

    # Trigger.dev
    TRIGGER_SECRET_KEY=...
    ```

4.  **Initialize Database:**
    ```bash
    npx prisma db push
    ```

5.  **Start the Development Server:**
    ```bash
    npm run dev
    ```

6.  **Start Trigger.dev (for background tasks):**
    In a separate terminal, run:
    ```bash
    npx trigger.dev@latest dev
    ```

Open [http://localhost:3000](http://localhost:3000) to start building workflows.
