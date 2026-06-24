# StackIt: A Travel Itinerary

# Overview

An intelligent, multi-domain planning and
reservation application designed to streamline organizing
and booking outings, vacations, and events.

# System Workflow

1. Insert Item: Manually add an itinerary row into the Dynamic Array.
2. Categorize: Use the Hash Map to group items by type (e.g., vacation vs. staycation).
3. Sort by Budget: Execute QuickSort to organize plans from cheapest to most expensive.
4. Filter by Constraints: Use Binary Search to find items that fit a specific price point.
5. Smart Recommend: Ingest the structured data via Node.js and call Gemini 2.5 Flash to
provide accommodation suggestions based on the descriptive "user constraints."


# Ai Integration

The application incorporates the Google Gemini 2.5 Flash API to process natural-language "vibe" requests—such as "a quiet anniversary staycation"—alongside the user's spreadsheet constraints to provide personalized, intelligent recommendations.System Advantages and Limitations

Advantages: The use of in-memory data structures ensures zero-latency data writes and independent data sovereignty. Localized sorting and filtering bypass the lag associated with commercial third-party databases.

Limitations: The system is ephemeral, meaning data clears if the backend server restarts. Additionally, the dataset is currently restricted to 1,000 pre-loaded properties, requiring manual insertion for expansion.
