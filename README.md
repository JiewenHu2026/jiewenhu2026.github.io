# Jiewen Hu — Landscape Architecture

Personal portfolio of [Jiewen Hu](https://jiewenhu2026.github.io/). The project index covers the work that credits Jiewen in the publicly listed Projects collection of [Field Notes Studio](https://yuehui-gong.github.io/). *Leaving Traces* uses the creator’s standalone project page for artwork and narrative. Project pages preserve team credits and link back to the studio originals.

- Edit project narratives, team credits, slides, and award announcements in `content/projects.json`.
- Edit institutional publications and press in `content/press.json`. Link directly to the original publisher's material that names Jiewen.
- Edit official personal honors in `content/honors.json`. Awards are organized by year and link to the awarding body or its official announcement.
- Put project media in `docs/media/<project-slug>/` and use paths relative to that folder in each project record.

Run `node scripts/build.mjs` to regenerate website pages and the sitemap. The site is static, with no dependencies. GitHub Pages publishes `main:/docs`. Commit the updated input files, media, and generated pages together.
