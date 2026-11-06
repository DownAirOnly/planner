# Command

A simple installable command center for tracking projects, tasks, ideas, and unfinished work.

## What works

- Home dashboard, project cards, task list, and idea parking lot
- Add, edit, complete, and delete tasks
- Add and edit projects with status, category, next step, and review date
- Link tasks to projects, assign priorities and optional due dates
- Filter and search tasks, promote an idea to a project
- Export and import your data as JSON
- Mobile-first layout and offline caching after initial load

## Data and privacy

**Version 1 is local-first.** Changes are saved to your current browser using localStorage, not Firebase. There is **no account login, cross-device synchronization, or cloud backup**. Clearing website data may remove your work. Use Settings → Export backup to save JSON and Settings → Import backup to restore it.

The starter list includes the names of a few publicly visible development projects. It does not contain personal health or payment records. Do not put secrets into the public repository.

## Publish with GitHub Pages

The deployment workflow is in `.github/workflows/pages.yml`.

1. Open [Settings → Pages](https://github.com/DownAirOnly/planner/settings/pages).
2. Under **Build and deployment**, select **GitHub Actions** as the Source.
3. The next push to `main` runs deployment, or rerun **Deploy Command to GitHub Pages** from the Actions tab.

When deployed, the URL is: https://downaironly.github.io/planner/

On iPhone open the link in Safari → Share → Add to Home Screen. No backend or build step is required.

## Planned

Cloud synchronization (Firebase), import of structured ChatGPT handoffs, optional project reviews and reminders.
