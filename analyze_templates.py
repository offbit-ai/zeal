#!/usr/bin/env python3
import json
import sys
from pathlib import Path

# Load the nodeTemplates.json file
file_path = Path("data/nodeTemplates.json")
with open(file_path, "r") as f:
    templates = json.load(f)

# Find all templates with select properties
templates_with_select = []

for template in templates:
    if "properties" not in template:
        continue
    
    select_properties = []
    for prop_name, prop_config in template["properties"].items():
        if prop_config.get("type") == "select":
            select_properties.append({
                "name": prop_name,
                "options": prop_config.get("options", []),
                "multiple": prop_config.get("multiple", False),
                "defaultValue": prop_config.get("defaultValue")
            })
    
    if select_properties:
        templates_with_select.append({
            "id": template["id"],
            "title": template["title"],
            "subtitle": template.get("subtitle", ""),
            "category": template.get("category", ""),
            "subcategory": template.get("subcategory", ""),
            "selectProperties": select_properties,
            "description": template.get("description", "")
        })

# Sort by category for better organization
templates_with_select.sort(key=lambda x: (x["category"], x["id"]))

# Print the results
print(f"Found {len(templates_with_select)} templates with select properties:\n")

for template in templates_with_select:
    print(f"Template ID: {template['id']}")
    print(f"Title: {template['title']} - {template['subtitle']}")
    print(f"Category: {template['category']} / {template['subcategory']}")
    print(f"Description: {template['description']}")
    print("Select Properties:")
    for prop in template["selectProperties"]:
        print(f"  - {prop['name']}:")
        print(f"    Options: {prop['options']}")
        if prop.get("multiple"):
            print(f"    Multiple: True")
        if prop.get("defaultValue"):
            print(f"    Default: {prop['defaultValue']}")
    print("\n" + "-"*80 + "\n")