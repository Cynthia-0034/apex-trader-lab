// Apex Engine — Toggle the master kill switch.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from 'jsr:@supabase/supabase-js/cors';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    const { kill_switch } = await req.json();
    const { data, error } = await supabase
      .from('configs').update({ kill_switch: !!kill_switch })
      .eq('active', true).select().single();
    if (error) throw error;
    await supabase.from('events').insert({
      type: kill_switch ? 'warning' : 'info', stage: 'safety',
      message: `Kill switch ${kill_switch ? 'ACTIVATED' : 'deactivated'}`,
    });
    return new Response(JSON.stringify({ ok: true, config: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
