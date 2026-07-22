import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import viVN from 'antd/es/locale/vi_VN';
import App from './App';
import './index.css';
import './styles/dev-ui-tokens.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 phút
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ConfigProvider
          locale={viVN}
          theme={{
            token: {
              colorPrimary: '#D2691E',
              borderRadius: 8,
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              colorBgLayout: '#F0F2F5',
              colorSuccess: '#52C41A',
              colorWarning: '#FAAD14',
              colorError: '#FF4D4F',
              colorInfo: '#D2691E',
            },
            components: {
              Menu: {
                darkItemBg: '#1A1A2E',
                darkSubMenuItemBg: '#1A1A2E',
                darkItemSelectedBg: 'rgba(210, 105, 30, 0.15)',
                darkItemSelectedColor: '#D2691E',
                darkItemHoverBg: 'rgba(255, 255, 255, 0.06)',
              },
              Layout: {
                siderBg: '#1A1A2E',
                headerBg: '#FFFFFF',
              },
              Table: {
                headerBg: '#FFF8DC',
                headerColor: '#8B4513',
              },
              Card: {
                borderRadiusLG: 12,
              },
            },
          }}
        >
          <App />
        </ConfigProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
