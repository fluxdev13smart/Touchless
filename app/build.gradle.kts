plugins {
    id("com.android.application")
}

android {
    namespace = "app.roadie.player"
    compileSdk = 34

    defaultConfig {
        applicationId = "app.roadie.player"
        minSdk = 21
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    signingConfigs {
        create("roadie") {
            storeFile = file("roadie.keystore")
            storePassword = "roadie-local"
            keyAlias = "roadie"
            keyPassword = "roadie-local"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("roadie")
        }
        debug {
            signingConfig = signingConfigs.getByName("roadie")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }
}
