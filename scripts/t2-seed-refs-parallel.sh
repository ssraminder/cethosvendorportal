#!/bin/bash
# Fire cvp-seed-library-refs in parallel per row. 150s function timeout
# means each call should comfortably finish one Opus draft.
set -u
IDS=(
  0ee7917d-3ff7-4521-b40e-7ad5e0d00467
  e2730af4-2e38-42c7-837b-73e468cce824
  8b1b3ac5-1a6d-47f3-967a-e006336055b1
  b9aed2a0-294d-40ed-abe8-f453a2b326ca
  02d0afc1-67b6-4a84-bdfc-043b77d3d049
  759c6cbc-82b7-42cf-9efa-883a464f3111
  9f96ad79-2e45-4bd7-8372-fa5a7ca574f3
  b462c6c6-b2ac-4df4-bc7d-7fcf3356faa1
  7981792a-7aa2-43f9-9b67-86e8bcb67821
  77763495-57ea-4ccc-8f09-2e2203e4edff
  04aaf420-7791-412e-9fe8-a6860ea39e8c
  bf852da4-aad2-4d0d-be69-08e5affbe63b
  20ad2773-44c8-4b53-a19d-e37247b5fbab
  e6484bbd-7e2d-4c33-8224-57da19ac218f
  39a2d949-ce08-4f4c-a395-38c75032681c
  de7c6e6e-48a7-4838-b8e7-6f4f507927ce
  cdb23893-3de2-4892-afca-a24f391fe3b3
  a25fe7cc-99c4-4963-aca5-1d093541f20e
  8cb2da6d-54b3-4c24-a56c-afd0879b2b7e
  7b213d96-9a0c-4f49-b2ef-896a9bba50c5
  c841916d-bba7-4b2a-8f94-d5d3a879aabe
  f161fd0a-1c75-4e86-8722-fd044e6e6ad2
  d399dc1e-41f3-4881-9c7a-5b7479608f04
  6042ec96-aeb4-4411-9797-e80c0f0ec514
)
URL="https://lmzoyezvsjgsxveoakdr.supabase.co/functions/v1/cvp-seed-library-refs"
for id in "${IDS[@]}"; do
  curl -s -X POST "$URL" -H "Content-Type: application/json" -d "{\"libraryRowId\":\"$id\"}" --max-time 150 > /dev/null 2>&1 &
done
wait
echo "done"
