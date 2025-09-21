const { createClient } = require('@supabase/supabase-js')

// Use service role key for admin operations
const supabaseUrl = 'http://127.0.0.1:55321'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createTestUser() {
  // Get user input
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise((resolve) => readline.question(query, resolve));

  console.log('\n📝 Create Test User for Calendar App\n');

  const email = await question('Email: ');
  const password = await question('Password: ');
  const firstName = await question('First Name: ');
  const lastName = await question('Last Name: ');

  readline.close();

  try {
    // Create user with admin API
    const { data: user, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName
      }
    })

    if (userError) {
      console.error('Error creating user:', userError)
      return
    }

    console.log('User created successfully:', user.user.id, user.user.email)

    // Create user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: user.user.id,
        email: user.user.email,
        first_name: 'Michael',
        last_name: 'Brasket',
        display_name: 'Michael Brasket',
        timezone: 'America/New_York'
      })

    if (profileError) {
      console.error('Error creating user profile:', profileError)
      return
    }

    console.log('User profile created successfully')

    // Create some sample event categories
    const { error: categoriesError } = await supabase
      .from('user_event_categories')
      .insert([
        { user_id: user.user.id, name: 'Work', color: 'blue' },
        { user_id: user.user.id, name: 'Personal', color: 'green' },
        { user_id: user.user.id, name: 'Meeting', color: 'orange' },
        { user_id: user.user.id, name: 'Important', color: 'rose' }
      ])

    if (categoriesError) {
      console.error('Error creating event categories:', categoriesError)
      return
    }

    console.log('Sample event categories created successfully')
    console.log('\nTest user setup complete!')
    console.log('Email: michael@coincrew.ai')
    console.log('Password: Betty923!')

  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

createTestUser()