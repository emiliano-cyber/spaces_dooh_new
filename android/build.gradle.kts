// android/build.gradle.kts (raíz)
// Declara las versiones de los plugins una sola vez; los módulos (:app) solo los aplican.
plugins {
    id("com.android.application") version "8.5.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.24" apply false
}
