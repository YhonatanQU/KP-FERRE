
  # SaaS Product Design

  This is a code bundle for SaaS Product Design. The original project is available at https://www.figma.com/design/9Od0oJ9Cnw1P0iJP1mkbW9/SaaS-Product-Design.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Supabase Database

  This project is prepared to use a Supabase PostgreSQL database via the backend `DATABASE_URL`.
  - Copy `backend/.env.example` to `backend/.env` and set your Supabase connection string.
  - Set `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_ISSUER`, `JWT_AUDIENCE` and `PORT` as needed.

  ## Git and Deployment

  The repository has been initialized locally with Git and the initial commit has been created.
  To deploy a remote repository, add a Git remote or use GitHub/GitLab after creating the remote repository.

  For Supabase deployment you can use the Supabase CLI:
  - `supabase login`
  - `supabase init`
  - `supabase db push`
  - `supabase start`
  