# 📌 Project Management API

A robust Node.js backend API built with Express.js and MongoDB, designed for efficient management of users, projects, and tasks. This API features role-based access control, JWT authentication, and optimized database interactions to support multi-user collaboration.

---

## ✨ Features

*   **User Management:** Secure user registration, login, and profile management.
*   **Project Management:** Create, read, update, and delete projects, with the ability to assign members and roles.
*   **Task Management:** Comprehensive CRUD operations for tasks within projects, including status tracking, prioritization, and assignment.
*   **Role-Based Access Control (RBAC):** Differentiate permissions for `Admin`, `Project Manager`, and `Member` roles.
*   **JWT Authentication:** Secure API endpoints using JSON Web Tokens.
*   **Token Blacklisting:** Invalidate JWTs upon logout to enhance security.
*   **Database Transactions:** Ensure data consistency for critical operations like project creation/deletion.
*   **Optimized Queries:** Indexes designed for fast retrieval of common data patterns (e.g., user's projects, tasks due soon).

---

## 🚀 Getting Started

Follow these steps to set up and run the project locally:

1.  **Clone the Repository:**
    ```bash
    git clone [your-repository-url]
    cd [your-project-directory]
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Create a `.env` file in the root directory with the following structure:
    ```env
    PORT=3000
    MONGO_URI=your_mongodb_connection_string
    JWT_SECRET=your_jwt_secret_key
    JWT_EXPIRES_IN=1d
    ```
    *Replace placeholders with your actual values.*

4.  **Start the Server:**
    ```bash
    npm start
    ```
    Or, for development with hot-reloading:
    ```bash
    nodemon server.js
    ```

---


## 📖 API Documentation

Explore the API endpoints using the provided Postman Collection. Import the `ProjectManagementAPI.postman_collection.json` file into Postman to easily test:

*   Authentication endpoints (signup, login, logout)
*   Project management endpoints (CRUD, member assignment)
*   Task management endpoints (CRUD, filtering, pagination)

---

## 🗄️ Database Schema (MongoDB with Mongoose)

### 👤 User Model

*   `name`: String (required, trimmed)
*   `email`: String (required, unique, lowercase, indexed)
*   `password`: String (hashed, min 6 chars)
*   `role`: Enum (`Admin` | `Project Manager` | `Member`)
*   `createdAt`: Date (default: now)

### 📂 Project Model

*   `name`: String (required, indexed)
*   `description`: String (optional)
*   `status`: Enum (`active` | `archived`, default: `active`, indexed)
*   `owner`: ObjectId → User (required, indexed)
*   `members`: Array of `{ user: ObjectId, role: 'Project Manager' | 'Member' }`
*   `createdAt` / `updatedAt`: Date (timestamps)

### ✅ Task Model

*   `project`: ObjectId → Project (required, indexed)
*   `title`: String (required, indexed)
*   `description`: String (optional)
*   `status`: Enum (`todo` | `in-progress` | `done`, indexed)
*   `priority`: Enum (`low` | `medium` | `high`, indexed)
*   `dueDate`: Date (indexed)
*   `assignee`: ObjectId → User (optional, indexed)
*   `createdAt` / `updatedAt`: Date

### 🔒 BlacklistedToken Model

*   `token`: String (unique, indexed)
*   `expiresAt`: Date (with TTL index for automatic expiration)

---

## 💡 Reasoning & Design Decisions

### 🎯 Core Goals

*   Enable multi-user collaboration on projects and tasks.
*   Implement robust role-based access control.
*   Ensure fast query performance for common workflows.
*   Maintain data consistency through atomic operations.
*   Provide strong security with password hashing and JWT blacklisting.

### 👥 User ↔ Project Relationship (Many-to-Many)

*   **Implementation:** Embedded `members` array within the `Project` model.
*   **Pros:** Efficiently loads a project with its members in a single query.
*   **Cons:** Potential document size increase with very large memberships. A `ProjectMember` join collection could be considered for extreme scale.

### 📂 Project ↔ Task Relationship (One-to-Many)

*   **Implementation:** Separate `Task` collection referencing the `Project` via `ObjectId`.
*   **Pros:** Prevents the `Project` document from becoming bloated, especially with many tasks.
*   **Cons:** Requires separate queries to fetch tasks for a project, which is acceptable given task pagination.

### ⚡ Indexing Strategy

Indexes are strategically applied to optimize frequent queries:

*   `Task`: `{ project: 1 }` → Fetch tasks by project.
*   `Task`: `{ assignee: 1, status: 1 }` → Find tasks assigned to a user with a specific status.
*   `Task`: `{ dueDate: 1 }` → List upcoming or overdue tasks.
*   `Project`: `{ 'members.user': 1 }` → Find projects a user is a member of.
*   `Project`: `{ owner: 1 }` → Retrieve projects owned by a specific user.
*   `BlacklistedToken`: TTL index on `expiresAt` → Automatically cleans up expired tokens.

*Note: Indexes are created only for actual query patterns to balance performance gains against write costs.*

### 🔄 Transactions (Atomic Operations)

Used to ensure data integrity for operations involving multiple document modifications:

*   Creating a project along with its default tasks.
*   Deleting a project and all its associated tasks.

Implemented using MongoDB sessions:
```javascript
const session = await mongoose.startSession();
session.startTransaction();
try {
  // Perform multiple create/delete operations
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```
This prevents partial failures, ensuring operations are either fully completed or fully rolled back.

### 🔐 Security Measures

*   **Password Hashing:** Passwords are securely hashed using `bcrypt` and never stored in plain text.
*   **JWT Authentication:** Utilizes short-lived JWTs for authentication, with expiry enforced.
*   **Token Blacklisting:** The `BlacklistedToken` model invalidates JWTs upon logout, with expired tokens automatically removed via TTL.
*   **Alternative:** A short-lived access token + refresh token strategy could be implemented in the future.

### ✅ Validation & Business Rules

*   Enforced using Joi schema validation and backend logic.
*   **Key Rules:**
    *   A Project must have exactly one designated Project Manager.
    *   The owner of a Project must have the `Admin` role.
*   *Note: Some complex rules (e.g., "exactly one manager") require application-level logic beyond simple MongoDB indexes.*

### 📊 Observability & Scaling Considerations

*   `createdAt` and `updatedAt` timestamps are enabled on relevant models.
*   **Potential Future Extensions:**
    *   Implement an audit log collection for detailed membership and task history.
    *   Consider sharding the `Task` collection for very large-scale applications.
    *   Integrate caching (e.g., Redis) for frequently accessed data like dashboard summaries.

---

## 📝 Summary

This API is designed for efficiency and collaboration, offering:

*   Streamlined data retrieval for common workflows (projects with members, paginated tasks).
*   Optimized performance through strategic indexing.
*   High data integrity via atomic transactions and robust validation.
*   Secure authentication and authorization mechanisms.
*   Flexibility to scale by adjusting data modeling strategies as needed.

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.






