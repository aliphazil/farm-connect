# Dhivehi web fonts

- `MV_Waheed.otf` — MV Waheed (headings). Named after the calligrapher Abdulla
  Waheed of the Office of the President; created by Hassan Shujau and Hassan
  Hameed (1996). Re-mapped edition by Ahmed Niyaz (2009).
- `MV_Faseyha.otf` — MV Faseyha (body text). Calligraphy by Abdulla Waheed,
  Office of the President; managed by Hassan Shujau; edited by Hassan Hameed
  (1995). "All rights reserved." Re-mapped edition by Ahmed Niyaz (2009).

Source: https://dhivehi.mv/fonts/ (no licence stated there). The font files
mark their copyright as reserved, editing as restricted and embedding as
"preview & print".

These files are published on the site **with permission obtained by the
project owner** (recorded 2026-10-18). Keep a copy of that written
permission. Don't modify the files, and don't add other fonts from the same
source without confirming permission for each.

## Not in the repository

The `.otf` files are git-ignored so they aren't redistributed through the
public GitHub repository. A fresh clone **won't build** until both files are
copied into `src/fonts/` (from the owner's machine, or from
https://dhivehi.mv/fonts/data/df/MV_Waheed.otf and `MV_Faseyha.otf`, same
permission terms). The VPS deploy copies them from the owner's Mac.
