
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error("Supabase URL or Secret Key is missing in .env");
}

const supabase = createClient(supabaseUrl, supabaseSecretKey);

module.exports = supabase;
