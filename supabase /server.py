# server.py
# Main backend file — runs the whole app using Python Flask.
# To start: python server.py
# Visit: http://localhost:5000

from flask import Flask, request, jsonify, render_template
import random
import traceback

# Create the Flask app.
# 'templates' folder is where our HTML page lives.
# 'static' folder is where CSS and JS live.
app = Flask(__name__, template_folder='templates', static_folder='static')


# ─────────────────────────────────────────────
# SECTION 1 — GENERATE THE 1,000 PLACES DATA
# ─────────────────────────────────────────────
# This builds our dataset at server startup so it's ready to serve
# whenever the frontend asks for the listings.

def build_places_dataset():
    # Base locations grouped by region
    regions = {
        "Luzon": [
            {"city": "Baguio City",     "type": "Cabin",      "desc": "Pine breeze mountain retreat with scenic valley views."},
            {"city": "Tagaytay",        "type": "Staycation",  "desc": "Sleek modern suite featuring a view of Taal Volcano."},
            {"city": "El Nido, Palawan","type": "Resort",      "desc": "Premium beachfront villa tucked into dramatic limestone cliffs."},
            {"city": "Bataan",          "type": "Hotel",       "desc": "Heritage-themed campsite blending history and nature."}
        ],
        "Visayas": [
            {"city": "Boracay Island",  "type": "Resort",     "desc": "White-beach front suite with world-class sunsets and modern pools."},
            {"city": "Panglao, Bohol",  "type": "Villa",      "desc": "Eco-friendly sanctuary wrapped in tropical gardens."},
            {"city": "Cebu City",       "type": "Hotel",      "desc": "High-rise executive suite centered in the urban business hub."}
        ],
        "Mindanao": [
            {"city": "Siargao Island",          "type": "Villa",   "desc": "Rustic surf-style homestay located steps from famous breaks."},
            {"city": "Samal Island, Davao",     "type": "Resort",  "desc": "Relaxing coastal getaway with clear waters and private dock."},
            {"city": "Camiguin",                "type": "Cabin",   "desc": "Volcanic eco-lodge offering hot spring access and forest canopy."}
        ]
    }

    booking_types  = ["Vacation", "Staycation", "Outing"]
    room_types     = ["Single", "Suite", "Entire Home"]
    property_types = ["Hotel", "Cabin", "Resort", "Villa"]
    amenities_pool = ["Wi-Fi", "Pool", "Kitchen", "Parking"]
    access_pool    = ["Wheelchair Access", "Ramp entry"]

    adjectives = ["Serene", "Grand", "Cozy", "Vibrant", "Hidden-Gem", "Sleek", "Rustic", "Premium", "Eco", "Nomad's"]
    nouns      = ["Hideaway", "Vista", "Retreat", "Lodge", "Haven", "Plaza", "Sanctuary", "Suites", "Nook", "Oasis"]

    # x/y are percentage positions on our SVG map (0–100 range)
    city_coords = {
        "El Nido, Palawan":     (21, 71),
        "Tagaytay":             (40, 53),
        "Siargao Island":       (76, 74),
        "Baguio City":          (38, 32),
        "Boracay Island":       (44, 66),
        "Bataan":               (36, 44),
        "Panglao, Bohol":       (59, 78),
        "Cebu City":            (57, 72),
        "Samal Island, Davao":  (72, 89),
        "Camiguin":             (69, 81)
    }

    # Reusable Unsplash images so every property has a photo
    photos = [
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800",
        "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800",
        "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800",
        "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
        "https://images.unsplash.com/photo-1473116763269-255ea760466e?w=800",
        "https://images.unsplash.com/photo-1528909514045-2fa4ac7a08ba?w=800",
        "https://images.unsplash.com/photo-1449034446853-66c86144b0ad?w=800",
        "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800",
        "https://images.unsplash.com/photo-1494526585095-c41746248156?w=800",
        "https://images.unsplash.com/photo-1505691723518-36a1f8d3a5d1?w=800"
    ]

    dataset = []
    # Spread 1000 entries across three regions: 400 Luzon, 300 Visayas, 300 Mindanao
    distribution = [("Luzon", 400), ("Visayas", 300), ("Mindanao", 300)]

    idx = 1
    for region_name, count in distribution:
        loc_options = regions[region_name]
        for _ in range(count):
            base = loc_options[idx % len(loc_options)]
            name = f"{adjectives[idx % len(adjectives)]} {base['city']} {nouns[idx % len(nouns)]} #{idx}"

            # Price tiers: 10% luxury, 33% mid-range, rest budget
            if idx % 10 == 0:
                price = random.randint(35000, 99999)
            elif idx % 3 == 0:
                price = random.randint(6000, 34999)
            else:
                price = random.randint(800, 5999)

            bx, by = city_coords.get(base["city"], (50, 50))
            img = photos[idx % len(photos)]

            entry = {
                "id":            f"listing_{idx}",
                "name":          name,
                "property_name": name,
                "region":        region_name,
                "city":          base["city"],
                "location":      base["city"],
                "bookingType":   random.choice(booking_types),
                "booking_type":  random.choice(booking_types),
                "propertyType":  base["type"] if random.random() > 0.3 else random.choice(property_types),
                "property_type": base["type"] if random.random() > 0.3 else random.choice(property_types),
                "roomType":      random.choice(room_types),
                "room_type":     random.choice(room_types),
                "price":         price,
                "rating":        round(random.uniform(3.5, 5.0), 1),
                "review_count":  random.randint(15, 2800),
                "description":   f"{base['desc']} Great accommodation for all travel types.",
                "amenities":     random.sample(amenities_pool, random.randint(1, 4)),
                "accessibility": random.sample(access_pool, random.randint(0, 2)),
                "thumbnail":     img,
                "image_url":     img,
                "x":             round(bx + random.uniform(-2.0, 2.0), 2),
                "y":             round(by + random.uniform(-2.0, 2.0), 2),
                "lat":           round(random.uniform(6.0, 18.0), 4),
                "lng":           round(random.uniform(119.0, 126.0), 4)
            }
            dataset.append(entry)
            idx += 1

    return dataset

# Build the dataset once when the server starts
places_dataset = build_places_dataset()
print(f"[SERVER] Loaded {len(places_dataset)} Philippine places.")


# ─────────────────────────────────────────────
# SECTION 2 — SINGLY LINKED LIST (custom DS)
# ─────────────────────────────────────────────
# We manually implement a linked list so we avoid using Python's
# built-in list membership operators for the scratchpad notes.

class Node:
    # Each node holds one data item and a pointer to the next node
    def __init__(self, data):
        self.data = data
        self.next = None

class LinkedList:
    def __init__(self):
        self.head    = None
        self.size    = 0
        self.counter = 0  # keeps running count for unique ID generation

    def append(self, data):
        # Add a new node at the end of the list
        new_node = Node(data)
        self.counter += 1
        if not self.head:
            self.head = new_node
        else:
            cur = self.head
            while cur.next:
                cur = cur.next
            cur.next = new_node
        self.size += 1

    def to_list(self):
        # Walk the list and collect all data into a plain Python list
        result = []
        cur = self.head
        while cur:
            result.append(cur.data)
            cur = cur.next
        return result

    def clear(self):
        self.head    = None
        self.size    = 0
        self.counter = 0

    def contains(self, target, key_fn):
        # Manual membership check — walks nodes one by one instead of using 'in'
        cur = self.head
        while cur:
            if key_fn(cur.data) == target:
                return True
            cur = cur.next
        return False

    def remove_by_id(self, target_id):
        # Walk the list to find and unlink a node by its id field
        if not self.head:
            return False
        if self.head.data.get("id") == target_id:
            self.head = self.head.next
            self.size -= 1
            return True
        prev = self.head
        cur  = self.head.next
        while cur:
            if cur.data.get("id") == target_id:
                prev.next = cur.next
                self.size -= 1
                return True
            prev = cur
            cur  = cur.next
        return False

    def update_by_id(self, target_id, new_data):
        # Find a node by id and overwrite selected fields
        cur = self.head
        while cur:
            if cur.data.get("id") == target_id:
                cur.data.update(new_data)
                return True
            cur = cur.next
        return False

# The global linked list that stores all scratchpad notes
notes_list = LinkedList()


# ─────────────────────────────────────────────
# SECTION 3 — QUICKSORT (custom algorithm)
# ─────────────────────────────────────────────
# Manual implementation — does NOT use Python's sorted() or .sort()

def quicksort(arr, key_fn):
    if len(arr) <= 1:
        return arr

    pivot     = arr[len(arr) // 2]
    pivot_val = key_fn(pivot)

    left   = []
    middle = []
    right  = []

    for item in arr:
        val = key_fn(item)
        if val < pivot_val:
            left.append(item)
        elif val == pivot_val:
            middle.append(item)
        else:
            right.append(item)

    # Recursively sort both sides, then combine
    result = []
    for x in quicksort(left, key_fn):
        result.append(x)
    for x in middle:
        result.append(x)
    for x in quicksort(right, key_fn):
        result.append(x)
    return result


# ─────────────────────────────────────────────
# SECTION 4 — BINARY SEARCH (custom algorithm)
# ─────────────────────────────────────────────
# Two helpers: one finds the left boundary, one finds the right boundary.
# Used together to find all prices inside a given budget range.

def binary_search_lower(arr, target, key_fn):
    # Find index of first element >= target
    lo, hi, ans = 0, len(arr) - 1, -1
    while lo <= hi:
        mid = (lo + hi) // 2
        if key_fn(arr[mid]) >= target:
            ans = mid
            hi  = mid - 1
        else:
            lo = mid + 1
    return ans

def binary_search_upper(arr, target, key_fn):
    # Find index of last element <= target
    lo, hi, ans = 0, len(arr) - 1, -1
    while lo <= hi:
        mid = (lo + hi) // 2
        if key_fn(arr[mid]) <= target:
            ans = mid
            lo  = mid + 1
        else:
            hi = mid - 1
    return ans


# ─────────────────────────────────────────────
# SECTION 5 — IN-MEMORY TELEMETRY STORE
# ─────────────────────────────────────────────
# Simple Python lists that act as in-memory storage for
# search event logs and flash deals (resets when server restarts)

telemetry_log = []
deals_log     = []


# ─────────────────────────────────────────────
# SECTION 6 — ROUTES: PAGE & STATIC
# ─────────────────────────────────────────────

@app.route("/")
def home():
    # Render the single HTML page that contains the whole app
    return render_template("index.html")


# ─────────────────────────────────────────────
# SECTION 7 — ROUTES: LISTINGS API
# ─────────────────────────────────────────────

@app.route("/api/listings", methods=["GET"])
def get_listings():
    # Returns all 1,000 place entries as JSON
    return jsonify(places_dataset)


# ─────────────────────────────────────────────
# SECTION 8 — ROUTES: DATA STRUCTURE ENDPOINTS
# ─────────────────────────────────────────────

@app.route("/api/ds/sort", methods=["POST"])
def sort_listings():
    # Sorts listings by price using our manual QuickSort
    try:
        body     = request.json or {}
        listings = body.get("listings", [])
        if not isinstance(listings, list):
            return jsonify({"error": "listings must be an array"}), 400

        def get_price(item):
            try:
                return float(item.get("price", 0))
            except (ValueError, TypeError):
                return 0.0

        sorted_result = quicksort(listings, get_price)
        return jsonify({"sortedListings": sorted_result})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/ds/search", methods=["POST"])
def search_listings():
    # Filters listings within a price range using QuickSort + Binary Search
    try:
        body     = request.json or {}
        listings = body.get("listings", [])
        min_b    = float(body.get("min_budget", 0))
        max_b    = float(body.get("max_budget", body.get("budget", 99999)))

        if not isinstance(listings, list):
            return jsonify({"error": "listings must be an array"}), 400

        def get_price(item):
            try:
                return float(item.get("price", 0))
            except (ValueError, TypeError):
                return 0.0

        # Step 1: sort first so binary search works correctly
        sorted_list = quicksort(listings, get_price)

        # Step 2: find the range boundaries
        lo_idx = binary_search_lower(sorted_list, min_b, get_price)
        hi_idx = binary_search_upper(sorted_list, max_b, get_price)

        filtered = []
        if lo_idx != -1 and hi_idx != -1 and lo_idx <= hi_idx:
            for i in range(lo_idx, hi_idx + 1):
                filtered.append(sorted_list[i])

        return jsonify({
            "filteredListings":  filtered,
            "lowerBoundIndex":   lo_idx,
            "upperBoundIndex":   hi_idx
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────
# SECTION 9 — ROUTES: NOTES (LINKED LIST)
# ─────────────────────────────────────────────

@app.route("/api/ds/notes", methods=["GET", "POST", "DELETE"])
def manage_notes():
    # GET  → return all notes in the linked list
    # POST → add a new note node
    # DELETE → clear all notes
    try:
        if request.method == "POST":
            body     = request.json or {}
            content  = str(body.get("content", ""))
            companions = str(body.get("companions", "None"))
            category = str(body.get("category", "General"))
            try:
                budget = float(body.get("budget", 0))
            except (ValueError, TypeError):
                budget = 0.0

            note_id = f"note_{notes_list.counter + 1}_{int(budget)}"
            note = {
                "id":         note_id,
                "content":    content,
                "companions": companions,
                "budget":     budget,
                "category":   category
            }
            notes_list.append(note)
            return jsonify({"message": "Note added to linked list.", "note": note})

        elif request.method == "DELETE":
            notes_list.clear()
            return jsonify({"message": "All notes cleared from linked list."})

        else:
            return jsonify({"notes": notes_list.to_list()})

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/ds/notes/<note_id>", methods=["DELETE"])
def delete_note(note_id):
    # Remove a single note node by its ID
    try:
        removed = notes_list.remove_by_id(note_id)
        if removed:
            return jsonify({"message": f"Note {note_id} deleted.", "status": "ok"})
        return jsonify({"error": f"Note {note_id} not found."}), 404
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/ds/notes/<note_id>", methods=["PUT"])
def update_note(note_id):
    # Update a specific note's fields in place
    try:
        body = request.json or {}
        changes = {}
        if "content"    in body: changes["content"]    = str(body["content"])
        if "companions" in body: changes["companions"]  = str(body["companions"])
        if "category"   in body: changes["category"]   = str(body["category"])
        if "budget"     in body:
            try:
                changes["budget"] = float(body["budget"])
            except (ValueError, TypeError):
                changes["budget"] = 0.0

        updated = notes_list.update_by_id(note_id, changes)
        if updated:
            return jsonify({"message": f"Note {note_id} updated.", "status": "ok"})
        return jsonify({"error": f"Note {note_id} not found."}), 404
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/ds/categorize", methods=["POST"])
def categorize_notes():
    # Groups notes by category WITHOUT using dict lookups —
    # uses the linked list's manual contains() check instead
    try:
        all_notes = notes_list.to_list()

        # Build unique category list using linked list traversal
        cat_list = LinkedList()
        for note in all_notes:
            cat = note.get("category", "General")
            if not cat_list.contains(cat, lambda x: x):
                cat_list.append(cat)

        unique_cats = cat_list.to_list()

        # Group notes per category using plain loops
        grouped = []
        for cat in unique_cats:
            items = []
            for note in all_notes:
                if note.get("category") == cat:
                    items.append(note)
            grouped.append({"category": cat, "items": items})

        return jsonify({"categorized": grouped})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────
# SECTION 10 — ROUTES: TELEMETRY & DEALS
# ─────────────────────────────────────────────

@app.route("/track-search", methods=["POST"])
def track_search():
    # Records a search event and may trigger a flash deal
    try:
        body   = request.json or {}
        city   = body.get("destination_city", "All")
        budget = float(body.get("target_budget", 99999))
        guests = int(body.get("guest_count", 2))
        clicks = int(body.get("property_clicks", 0))

        event = {
            "timestamp":        body.get("timestamp", ""),
            "destination_city": city,
            "guest_count":      guests,
            "target_budget":    budget,
            "property_clicks":  clicks
        }
        telemetry_log.insert(0, event)

        # Check if same city was searched 3+ times → trigger a deal
        same_city = [e for e in telemetry_log if e["destination_city"].lower() == city.lower()]
        budget_dropped = (
            len(telemetry_log) > 1
            and telemetry_log[1]["destination_city"] == city
            and budget < telemetry_log[1]["target_budget"]
        )

        deal_result = None
        if len(same_city) >= 3 or budget_dropped:
            pool = [p for p in places_dataset if city == "All" or p["city"].lower() == city.lower()]
            if not pool:
                pool = places_dataset

            # Pick the property closest to the user's budget
            match = min(pool, key=lambda x: abs(x["price"] - budget))
            amenity_str = ", ".join(match["amenities"]) if match["amenities"] else "great amenities"
            pitch = (
                f"We found '{match['property_name']}' in {match['city']} — "
                f"a great pick with {amenity_str}! Perfect for your trip."
            )
            deal = {
                "id":                  f"deal_{random.randint(100000, 999999)}",
                "timestamp":           event["timestamp"],
                "destination_city":    city,
                "property_name":       match["property_name"],
                "original_price":      match["price"],
                "deal_price":          int(match["price"] * 0.8),
                "booking_intent_score": 85,
                "concierge_pitch":     pitch,
                "thumbnail":           match["thumbnail"],
                "amenities":           match["amenities"],
                "star_rating":         4.7,
                "review_count":        1420
            }
            deals_log.insert(0, deal)
            if len(deals_log) > 20:
                deals_log.pop()
            deal_result = deal

        return jsonify({
            "message":      "Telemetry logged.",
            "event":        event,
            "dealTriggered": deal_result is not None,
            "deal":         deal_result
        }), 201

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/telemetry", methods=["GET"])
def get_telemetry():
    return jsonify(telemetry_log)


@app.route("/api/deals", methods=["GET"])
def get_deals():
    return jsonify(deals_log)


@app.route("/api/reset", methods=["POST"])
def reset_all():
    # Wipes all in-memory data (telemetry, deals, notes)
    telemetry_log.clear()
    deals_log.clear()
    notes_list.clear()
    return jsonify({"status": "ok", "message": "All data reset."})


@app.route("/api/generate-pitch", methods=["POST"])
def generate_pitch():
    # Returns a simple travel pitch for a given property
    body  = request.json or {}
    name  = body.get("name", "Campsite")
    city  = body.get("city", "Philippines")
    price = body.get("price", 0)
    pitch = (
        f"'{name}' in {city} is a fantastic pick at ₱{price}/night. "
        f"Great for unwinding, exploring local spots, and making memories."
    )
    return jsonify({"pitch": pitch})


# ─────────────────────────────────────────────
# SECTION 11 — START THE SERVER
# ─────────────────────────────────────────────

if __name__ == "__main__":
    print("[SERVER] Starting StackIt on http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
