import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const authorization = request.headers.get('Authorization');
  if (!authorization) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

  const client = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authorization } } },
  );
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
  const { error } = await admin.auth.admin.deleteUser(user.id, true);
  if (error) return new Response(error.message, { status: 400, headers: corsHeaders });
  return Response.json({ deleted: true }, { headers: corsHeaders });
});
