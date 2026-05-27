/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slack: {
          purple: {
            deep: '#3F0E40',     // Left Workspace Sidebar
            mid: '#522653',      // Channel Navigation Sidebar
            light: '#613064',    // Channel list hover state
            hover: '#350d36',    // Deep sidebar hover
            selected: '#1164A3', // Accent color (Slack blue)
          },
          dark: '#1D1C1D',       // Dark primary text
          muted: '#616061',      // Muted gray text
          bg: '#F8F8F8',         // Off-white background
          border: '#E8E8E8',     // Custom border color
          lightBorder: '#E8E8E8',// Secondary border
          avatar: {
            online: '#2BAC76',   // Slack online green
            away: '#D1D2D3',     // Slack away gray
          }
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        'slack-header': '0 1px 0 0 rgba(0, 0, 0, 0.1)',
        'slack-popover': '0 0 0 1px rgba(29, 28, 29, 0.13), 0 4px 12px 0 rgba(0, 0, 0, 0.08)',
        'slack-modal': '0 0 0 1px rgba(29, 28, 29, 0.13), 0 12px 24px 0 rgba(0, 0, 0, 0.15)',
      }
    },
  },
  plugins: [],
}
