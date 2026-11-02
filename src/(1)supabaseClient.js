import { createClient } from '@supabase/supabase-js';

// Tu URL y la nueva Anon Key directa de Supabase
const supabaseUrl = 'https://ihzuhxbsxrdpujgohwyl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxbmJuZGxwdHB1ZHJudXhjdmhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NzEwNTUsImV4cCI6MjEwOTE0NzA1NX0.77KKeVNMXdThEckbTczbpWAqdSuUayzxxR2cCc3ojPk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);