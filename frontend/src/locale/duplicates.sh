#!/bin/bash

FILE="messages.xlf"

# Check if file exists
[ ! -f "$FILE" ] && { echo "Error: File '$FILE' not found"; exit 1; }

# Extract <source> contents, normalize whitespace, count duplicates
echo "Duplicates:"
grep -o '<source>[^<]*</source>' "$FILE" | sed 's/<source>\(.*\)<\/source>/\1/' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | sort | uniq -c | while read -r count str; do
    [ "$count" -gt 1 ] && echo "$str (found $count times)"
done
