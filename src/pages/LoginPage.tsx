import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sigma-blue to-sigma-dark flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-sigma-blue mb-2">
              Σ SigmaDesk
            </h1>
            <p className="text-gray-600 italic">Where Every Step Counts</p>
          </div>

          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#0066CC',
                    brandAccent: '#0052A3',
                  },
                },
              },
              className: {
                container: 'auth-container',
                button: 'auth-button',
              },
            }}
            providers={['google']}
            redirectTo={`${window.location.origin}/dashboard`}
            onlyThirdPartyProviders
            localization={{
              variables: {
                sign_in: {
                  email_label: 'Email',
                  password_label: 'Password',
                  email_input_placeholder: 'Your email address',
                  password_input_placeholder: 'Your password',
                  button_label: 'Sign in',
                  loading_button_label: 'Signing in ...',
                  social_provider_text: 'Sign in with {{provider}}',
                },
              },
            }}
          />

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>For demo purposes, you'll be assigned a student role.</p>
            <p className="mt-2">Contact admin to change roles.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;