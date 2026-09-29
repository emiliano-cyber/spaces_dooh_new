// android/app/build.gradle.kts
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.spaceeye.agent"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.spaceeye.agent"
        minSdk = 26
        targetSdk = 34
        versionCode = 28
        versionName = "0.15.12"

        // URL del backend. Default = IP LAN de la PC (Wi-Fi) para celular real.
        // Override sin tocar codigo:  ./gradlew assembleDebug -PserverUrl=http://192.168.1.80:4000
        // Para el emulador usa:       -PserverUrl=http://10.0.2.2:4000
        val serverUrl = (project.findProperty("serverUrl") as String?) ?: "http://192.168.100.135:4000"
        buildConfigField("String", "SERVER_URL", "\"$serverUrl\"")

        // Solo ARM de 64 bits. Toda la flota lo es (Samsung A14, A24, A26 y A70
        // al 23-sep-2026). Cada arquitectura extra son ~15 MB de bibliotecas
        // nativas (WebRTC + OpenCV) que cada equipo baja por datos en cada
        // actualizacion. Si algun dia entra un telefono de 32 bits, la
        // actualizacion le fallara con "no compatible" (se ve en el dashboard):
        // agregar "armeabi-v7a" aqui. Para el emulador, usar una imagen ARM64.
        ndk {
            abiFilters += listOf("arm64-v8a")
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.14"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.2")
    implementation("androidx.activity:activity-compose:1.9.0")
    // Fragment moderno. No se usa ningun Fragment en la app, pero llega por
    // dependencias en una version vieja y lint bloquea la compilacion: las
    // FragmentActivity previas a la 1.3.0 no llamaban a
    // super.onRequestPermissionsResult, asi que el resultado de pedir permisos
    // podia perderse. Fijar una version moderna lo resuelve de raiz.
    implementation("androidx.fragment:fragment-ktx:1.8.2")
    implementation(platform("androidx.compose:compose-bom:2024.06.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")

    // CameraX
    implementation("androidx.camera:camera-core:1.3.4")
    implementation("androidx.camera:camera-camera2:1.3.4")
    implementation("androidx.camera:camera-lifecycle:1.3.4")

    // WorkManager
    implementation("androidx.work:work-runtime-ktx:2.9.0")

    // Network
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-moshi:2.11.0")
    implementation("io.socket:socket.io-client:2.1.0")

    // WebRTC
    implementation("io.getstream:stream-webrtc-android:1.1.1")

    // Security
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // Location
    implementation("com.google.android.gms:play-services-location:21.3.0")

    // Vision (ORB): reconocer el creativo de la pantalla DENTRO del telefono,
    // aunque el sol lo deslave o sea de noche. Ver creativos/Reconocedor.kt.
    implementation("org.opencv:opencv:4.10.0")

    // Pruebas locales (JVM, sin telefono): ./gradlew testDebugUnitTest
    testImplementation("junit:junit:4.13.2")
    // org.json de verdad: el de android.jar en las pruebas locales es un cascaron vacio.
    testImplementation("org.json:json:20240303")
}
