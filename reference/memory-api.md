# Memory API

This document describes the Memory API endpoints used to manage diary entries, semantic user profiles, and glossary terms for personas.

## Diary Entries (日记记忆)

### Create a Diary Entry
- **Method:** POST
- **URL:** `/personas/{persona_name}/diary`
- **Request Body:**
  - `group_id` or `group` (string, optional) – Group identifier. Default: `"default"`.
  - `content` (string, optional) – Diary content.
  - `summary` (string, optional) – Summary of the entry. Falls back to first 80 characters of content.
  - `keywords` (string or array of strings, optional) – Keywords. If string, commas or Chinese commas separate values.
  - `entry_id` (string, optional) – Custom entry ID. Generated automatically if omitted.
  - `created_at` (string, ISO 8601, optional) – Creation timestamp. Defaults to current UTC time.
  - `source_ids` (array of strings, optional) – Source IDs.
  - `embedding` (array of numbers, optional) – Vector embedding.
  - `merge_count` (int, optional) – Number of merges.
  - `source_diary_ids` (array of strings, optional) – Source diary IDs that were merged into this entry.
- **Response:** `201 Created` with JSON `{"success": true, "entry": {...}}`.

### Get Diary Entries
- **Method:** GET
- **URL:** `/personas/{persona_name}/diary`
- **Query Parameters:**
  - `group_id` (string, optional) – Filter by group. If omitted, returns entries from the default group.
  - `page` (int, optional) – Page number, starting from 1. Default: 1.
  - `page_size` (int, optional) – Items per page. Default: 20.
- **Response:** `200 OK` with JSON `{"entries": [...], "total": ..., "page": ..., "page_size": ...}`.

### Get a Specific Diary Entry
- **Method:** GET
- **URL:** `/personas/{persona_name}/diary/{entry_id}`
- **Response:** `200 OK` with JSON `{"entry": {...}}`.

### Update a Diary Entry
- **Method:** PUT
- **URL:** `/personas/{persona_name}/diary/{entry_id}`
- **Request Body:** (all fields optional, only provided fields are updated)
  - `group_id` or `group` (string) – New group ID. If different from current, the entry is moved to the new group.
  - `content` (string)
  - `summary` (string)
  - `created_at` (string, ISO 8601)
  - `keywords` (string or array of strings)
  - `source_ids` (array of strings)
  - `source_diary_ids` (array of strings)
  - `merge_count` (int)
- **Response:** `200 OK` with JSON `{"success": true, "entry": {...}}`.

### Delete a Diary Entry
- **Method:** DELETE
- **URL:** `/personas/{persona_name}/diary/{entry_id}`
- **Response:** `200 OK` with JSON `{"success": true}`.

## Semantic User Profiles (语义用户画像)

### List Users
- **Method:** GET
- **URL:** `/personas/{persona_name}/users`
- **Query Parameters:**
  - `group_id` (string, optional) – If provided, lists only users belonging to that group; otherwise lists across all groups.
  - `search` (string, optional) – Fuzzy match on user name or user_id.
- **Response:** `200 OK` with JSON `{"users": [...], "total": int, "groups": [...]}`.

### Get a Specific User
- **Method:** GET
- **URL:** `/personas/{persona_name}/users/{user_id}`
- **Query Parameters:**
  - `group_id` (string, required) – Group the user belongs to.
- **Response:** `200 OK` with JSON `{"user": {...}}`.

### Create or Update a User
- **Method:** PUT
- **URL:** `/personas/{persona_name}/users/{user_id}`
- **Request Body:** (all fields optional; creates if not exists, updates if exists)
  - `group_id` (string, required) – Group identifier.
  - `name` (string)
  - `engagement_rate` (float, 0–1)
  - `interaction_count` (int)
  - `first_interaction_at` (string, ISO 8601)
  - `last_interaction_at` (string, ISO 8601)
- **Response:** `200 OK` with JSON `{"success": true, "user": {...}}`.

### Delete a User
- **Method:** DELETE
- **URL:** `/personas/{persona_name}/users/{user_id}`
- **Query Parameters:**
  - `group_id` (string, optional) – If provided, deletes only from that group; otherwise deletes from all groups.
- **Response:** `200 OK` with JSON `{"success": true, "deleted": int}`.

## Glossary Terms (术语表)

### List Glossary Terms
- **Method:** GET
- **URL:** `/personas/{persona_name}/glossary`
- **Query Parameters:**
  - `search` (string, optional) – Fuzzy match on term text.
  - `domain` (string, optional) – Filter by domain.
  - `page` (int, optional) – Page number. Default: 1.
  - `page_size` (int, optional) – Items per page. Default: 20.
- **Response:** `200 OK` with JSON `{"terms": [...], "stats": {...}, "total": int}`.

### Create a Glossary Term
- **Method:** POST
- **URL:** `/personas/{persona_name}/glossary`
- **Request Body:**
  - `term` (string, required) – The term text.
  - `definition` (string, optional) – Definition.
  - `source` (string, optional) – Source, e.g. "manual". Default: `"manual"`.
  - `confidence` (float, optional) – Confidence score. Default: 0.8.
  - `usage_count` (int, optional) – Number of usages. Default: 1.
  - `context_examples` (array of strings, optional) – Examples of usage.
  - `related_terms` (array of strings, optional) – Related terms.
  - `domain` (string, optional) – Domain/category. Default: `"custom"`.
- **Response:** `201 Created` with JSON `{"success": true, "term": {...}}`.

### Update a Glossary Term
- **Method:** PUT
- **URL:** `/personas/{persona_name}/glossary/{term}` (URL-encoded term)
- **Request Body:** (all fields optional)
  - `term` (string) – New term text (if changed, the term is renamed).
  - `definition`, `source`, `confidence`, `usage_count`, `context_examples`, `related_terms`, `domain`.
- **Response:** `200 OK` with JSON `{"success": true, "term": {...}}`.

### Delete a Glossary Term
- **Method:** DELETE
- **URL:** `/personas/{persona_name}/glossary/{term}` (URL-encoded term)
- **Response:** `200 OK` with JSON `{"success": true}`.

## Notes
- All responses follow the standard JSON format with success/error fields.
- Error responses use HTTP 4xx/5xx with `{"error": "message"}`.
- Persona name is part of the URL path (e.g., `/personas/default/...`).