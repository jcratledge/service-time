-- Run this once to create the initial manager
-- Then use the app's "Invite Manager" button for all future managers
INSERT INTO public.users (id, email, first_name, last_name, role)
VALUES (
    '00000000-0000-0000-0000-000000000000', -- replace with auth.users id after creating via Supabase Auth
    'manager@example.com',
    'First',
    'Last',
    'manager'
);