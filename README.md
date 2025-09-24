# Debug Notes

## Current Issue
- Supabase auth works perfectly
- Database queries hang indefinitely (never complete or error)
- Courses page shows loading forever
- Using React 18, Supabase, TypeScript

## What Works
- Authentication with Google
- User profiles load correctly  
- Auth state changes detected

## What Doesn't Work
- Any query to courses table hangs
- courseService.getCourses() never completes
- Even simple SELECT queries hang

## Environment
- Node version: [run `node --version`]
- NPM version: [run `npm --version`]
- Browser: [Chrome/Safari/Firefox?]
- OS: [Mac/Windows/Linux?]

## Supabase Project
- URL format: https://[project-ref].supabase.co
- Region: [check in Supabase dashboard]
- Created: [approximate date]
