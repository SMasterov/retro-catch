import fs from 'node:fs';
import path from 'node:path';

const candidates = ['game/index.html', 'index.html', 'www/index.html'];
const gamePath = process.argv[2] || candidates.find(p => fs.existsSync(p));
if (!gamePath || !fs.existsSync(gamePath)) {
  console.error('Не найден файл игры. Положи сохранённый index.html в корень репозитория (или game/index.html) и запусти снова.');
  process.exit(1);
}
const out = process.argv[3] || 'android-project';
const pkg = 'ru.sssipgames.retrocatch';
const pkgDir = pkg.split('.').join('/');
const W = (rel, content) => {
  const full = path.join(out, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
};

W('settings.gradle', `pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }
dependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS); repositories { google(); mavenCentral() } }
rootProject.name = 'RetroCatch'
include ':app'
`);

W('build.gradle', `plugins { id 'com.android.application' version '8.5.2' apply false }
`);

W('gradle.properties', `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.nonTransitiveRClass=true
`);

W('app/build.gradle', `plugins { id 'com.android.application' }

android {
    namespace '${pkg}'
    compileSdk 34

    defaultConfig {
        applicationId '${pkg}'
        minSdk 24
        targetSdk 34
        versionCode 33
        versionName '3.3'
    }

    buildTypes {
        release {
            minifyEnabled false
            shrinkResources false
            // подписываем debug-ключом, чтобы APK сразу устанавливался сайдлоадом;
            // для сторов замени на свой release-keystore через signingConfigs
            signingConfig signingConfigs.debug
        }
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}

dependencies {
    implementation 'androidx.webkit:webkit:1.11.0'
}
`);

W('app/src/main/AndroidManifest.xml', `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:allowBackup="true"
        android:icon="@drawable/ic_launcher"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:usesCleartextTraffic="false"
        android:theme="@style/AppTheme">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|screenLayout|smallestScreenSize|keyboardHidden|uiMode|density"
            android:launchMode="singleTask"
            android:theme="@style/AppTheme">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`);

W('app/src/main/java/' + pkgDir + '/MainActivity.java', `package ${pkg};

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

public class MainActivity extends Activity {
    private WebView web;
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/assets/index.html";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        w.setStatusBarColor(Color.TRANSPARENT);
        w.setNavigationBarColor(Color.parseColor("#16241f"));
        WebView.setWebContentsDebuggingEnabled(true);

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setTextZoom(100);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web.setWebViewClient(new WebViewClientCompat() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (HOST.equals(u.getHost())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Exception ignored) { }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage cm) {
                android.util.Log.d("RetroCatch", cm.message() + " @" + cm.lineNumber());
                return true;
            }
        });
        web.setBackgroundColor(Color.parseColor("#16241f"));
        web.loadUrl(START);
        hideSystemBars();
    }

    private void hideSystemBars() {
        View d = getWindow().getDecorView();
        d.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) web.evaluateJavascript("document.dispatchEvent(new Event('visibilitychange'));", null);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}
`);

W('app/src/main/res/values/strings.xml', `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Ретро-ловушка</string>
</resources>
`);

W('app/src/main/res/values/themes.xml', `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="android:Theme.Material.NoActionBar">
        <item name="android:windowBackground">#16241f</item>
        <item name="android:statusBarColor">#00000000</item>
        <item name="android:navigationBarColor">#16241f</item>
        <item name="android:windowLightStatusBar">false</item>
        <item name="android:windowFullscreen">true</item>
        <item name="android:windowContentOverlay">@null</item>
    </style>
</resources>
`);

W('app/src/main/res/drawable/ic_launcher.xml', `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="48dp" android:height="48dp"
    android:viewportWidth="48" android:viewportHeight="48">
    <path android:pathData="M12,2 h24 a10,10 0 0 1 10,10 v24 a10,10 0 0 1 -10,10 h-24 a10,10 0 0 1 -10,-10 v-24 a10,10 0 0 1 10,-10 z"
        android:fillColor="#1f6f6b" android:strokeColor="#20302c" android:strokeWidth="2"/>
    <path android:pathData="M24,8 l4.6,10.4 11.4,1.1 -8.6,7.6 2.6,11.2 -10,-5.9 -10,5.9 2.6,-11.2 -8.6,-7.6 11.4,-1.1 z"
        android:fillColor="#e04a3a" android:strokeColor="#20302c" android:strokeWidth="1.6"/>
    <path android:pathData="M24,18 a4.6,6 0 1,0 0.001,0 z" android:fillColor="#fff8ea" android:strokeColor="#20302c" android:strokeWidth="1.4"/>
</vector>
`);

fs.mkdirSync(path.join(out, 'app/src/main/assets'), { recursive: true });
fs.copyFileSync(gamePath, path.join(out, 'app/src/main/assets/index.html'));

console.log('Android-проект собран в ' + out + ' (игра: ' + gamePath + ').');
console.log('Дальше: gradle -p ' + out + ' assembleRelease');
console.log('APK: ' + out + '/app/build/outputs/apk/release/app-release.apk');
