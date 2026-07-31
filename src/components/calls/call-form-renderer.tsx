import { useColorScheme } from 'nativewind';
import React, { useMemo, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';

import { formRenderSource, jquerySource } from '../../utils/webview-scripts';

interface CallFormRendererProps {
  formSchemaJson: string;
  onFormDataChange: (formDataJson: string) => void;
  height?: number;
}

function buildHtml(formSchemaJson: string, isDark: boolean): string {
  const bg = isDark ? '#171717' : '#ffffff';
  const text = isDark ? '#f3f4f6' : '#111827';
  const border = isDark ? '#404040' : '#d1d5db';
  const inputBg = isDark ? '#262626' : '#f9fafb';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
<title>Call Form</title>
<script>${jquerySource}</script>
<script>${formRenderSource}</script>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 8px;
    background-color: ${bg};
    color: ${text};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
  }
  .rendered-form label { display: block; margin-bottom: 4px; font-weight: 500; }
  .rendered-form .form-group { margin-bottom: 12px; }
  .rendered-form input,
  .rendered-form select,
  .rendered-form textarea {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid ${border};
    border-radius: 6px;
    background: ${inputBg};
    color: ${text};
    font-size: 14px;
    outline: none;
  }
  .rendered-form input:focus,
  .rendered-form select:focus,
  .rendered-form textarea:focus {
    border-color: #2563eb;
  }
</style>
</head>
<body>
<form id="callForm" class="rendered-form"></form>
<script>
  var formData = ${formSchemaJson};
  $(function() {
    if (typeof formData === 'string') {
      try { formData = JSON.parse(formData); } catch(e) {}
    }
    $('#callForm').formRender({ formData: formData });

    // Send data up on any change
    function sendData() {
      var data = {};
      var fields = document.querySelectorAll('#callForm input, #callForm select, #callForm textarea');
      fields.forEach(function(el) {
        if (el.name) data[el.name] = el.value;
      });
      window.ReactNativeWebView.postMessage(JSON.stringify(data));
    }
    document.getElementById('callForm').addEventListener('change', sendData);
    document.getElementById('callForm').addEventListener('input', sendData);
  });
</script>
</body>
</html>`;
}

export const CallFormRenderer: React.FC<CallFormRendererProps> = ({ formSchemaJson, onFormDataChange, height = 400 }) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const webviewRef = useRef<WebView>(null);

  // Validate the schema is non-empty parseable JSON and neutralize `<` so a
  // schema containing `</script>` can't break out of the inline script tag
  const safeSchemaJson = useMemo(() => {
    if (!formSchemaJson || !formSchemaJson.trim()) return null;
    try {
      JSON.parse(formSchemaJson);
      return formSchemaJson.replace(/</g, '\\u003c');
    } catch {
      return null;
    }
  }, [formSchemaJson]);

  const html = useMemo(() => (safeSchemaJson ? buildHtml(safeSchemaJson, isDark) : null), [safeSchemaJson, isDark]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = event.nativeEvent.data;
      onFormDataChange(data);
    } catch {
      // ignore parse errors
    }
  };

  return (
    <View style={StyleSheet.flatten([styles.container, { height }, isDark ? styles.containerDark : styles.containerLight])}>
      {html ? (
        <WebView
          ref={webviewRef}
          originWhitelist={['*']}
          source={{ html }}
          style={styles.webview}
          onMessage={handleMessage}
          scrollEnabled={false}
          javaScriptEnabled
          domStorageEnabled
          cacheEnabled={false}
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator color="#2563eb" />
            </View>
          )}
          startInLoadingState
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
  },
  containerDark: { borderColor: '#404040' },
  containerLight: { borderColor: '#e5e7eb' },
  webview: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
