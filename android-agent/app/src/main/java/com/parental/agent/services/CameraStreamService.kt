package com.parental.agent.services

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import android.hardware.camera2.*
import android.media.ImageReader
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.util.Base64
import android.util.Log
import androidx.core.app.NotificationCompat
import io.socket.client.Socket
import org.json.JSONObject
import java.io.ByteArrayOutputStream

/**
 * Service to stream front or back camera in real-time to Parent Dashboard.
 * Supports remote switching between CameraCharacteristics.LENS_FACING_FRONT & LENS_FACING_BACK.
 */
class CameraStreamService : Service() {

    private var cameraDevice: CameraDevice? = null
    private var captureSession: CameraCaptureSession? = null
    private var imageReader: ImageReader? = null
    private var backgroundThread: HandlerThread? = null
    private var backgroundHandler: Handler? = null

    private var currentFacing = CameraCharacteristics.LENS_FACING_FRONT
    private var socket: Socket? = null

    companion object {
        const val CHANNEL_ID = "parental_camera_channel"
        const val NOTIFICATION_ID = 3003
        private const val TAG = "CameraStreamService"
    }

    override fun onCreate() {
        super.onCreate()
        startBackgroundThread()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())
        openCamera(currentFacing)
    }

    private fun startBackgroundThread() {
        backgroundThread = HandlerThread("CameraBackground").also { it.start() }
        backgroundHandler = Handler(backgroundThread!!.looper)
    }

    private fun openCamera(lensFacing: Int) {
        val manager = getSystemService(Context.CAMERA_SERVICE) as CameraManager
        try {
            val cameraId = manager.cameraIdList.firstOrNull { id ->
                val characteristics = manager.getCameraCharacteristics(id)
                characteristics.get(CameraCharacteristics.LENS_FACING) == lensFacing
            } ?: manager.cameraIdList[0]

            imageReader = ImageReader.newInstance(640, 480, ImageFormat.YUV_420_888, 2).apply {
                setOnImageAvailableListener({ reader ->
                    val image = reader.acquireLatestImage() ?: return@setOnImageAvailableListener
                    try {
                        val jpegBytes = yuv420ToJpeg(image)
                        val base64 = "data:image/jpeg;base64," + Base64.encodeToString(jpegBytes, Base64.NO_WRAP)
                        
                        val payload = JSONObject().apply {
                            put("deviceId", getDeviceId())
                            put("frame", base64)
                            put("facingMode", if (lensFacing == CameraCharacteristics.LENS_FACING_FRONT) "user" else "environment")
                        }
                        socket?.emit("child:camera_frame", payload)
                    } finally {
                        image.close()
                    }
                }, backgroundHandler)
            }

            manager.openCamera(cameraId, object : CameraDevice.StateCallback() {
                override fun onOpened(camera: CameraDevice) {
                    cameraDevice = camera
                    startCaptureSession()
                }

                override fun onDisconnected(camera: CameraDevice) {
                    camera.close()
                    cameraDevice = null
                }

                override fun onError(camera: CameraDevice, error: Int) {
                    camera.close()
                    cameraDevice = null
                }
            }, backgroundHandler)

        } catch (e: SecurityException) {
            Log.e(TAG, "Camera permission required: ${e.message}")
        }
    }

    private fun startCaptureSession() {
        val device = cameraDevice ?: return
        val reader = imageReader ?: return

        try {
            val previewRequestBuilder = device.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
                addTarget(reader.surface)
            }

            device.createCaptureSession(listOf(reader.surface), object : CameraCaptureSession.StateCallback() {
                override fun onConfigured(session: CameraCaptureSession) {
                    captureSession = session
                    previewRequestBuilder.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE)
                    session.setRepeatingRequest(previewRequestBuilder.build(), null, backgroundHandler)
                }

                override fun onConfigureFailed(session: CameraCaptureSession) {
                    Log.e(TAG, "Capture session configuration failed")
                }
            }, backgroundHandler)
        } catch (e: CameraAccessException) {
            Log.e(TAG, "Camera access error: ${e.message}")
        }
    }

    fun switchLens(lensFacing: Int) {
        currentFacing = lensFacing
        captureSession?.close()
        cameraDevice?.close()
        openCamera(currentFacing)
    }

    private fun yuv420ToJpeg(image: android.media.Image): ByteArray {
        val planes = image.planes
        val yBuffer = planes[0].buffer
        val uBuffer = planes[1].buffer
        val vBuffer = planes[2].buffer

        val ySize = yBuffer.remaining()
        val uSize = uBuffer.remaining()
        val vSize = vBuffer.remaining()

        val nv21 = ByteArray(ySize + uSize + vSize)
        yBuffer.get(nv21, 0, ySize)
        vBuffer.get(nv21, ySize, vSize)
        uBuffer.get(nv21, ySize + vSize, uSize)

        val yuvImage = YuvImage(nv21, ImageFormat.NV21, image.width, image.height, null)
        val out = ByteArrayOutputStream()
        yuvImage.compressToJpeg(Rect(0, 0, image.width, image.height), 65, out)
        return out.toByteArray()
    }

    private fun getDeviceId(): String {
        return android.provider.Settings.Secure.getString(
            contentResolver,
            android.provider.Settings.Secure.ANDROID_ID
        )
    }

    private fun buildNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Layanan Kamera Jarak Jauh Aktif")
            .setContentText("Kamera sedang dipantau oleh Orang Tua demi keselamatan")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Pemantauan Kamera",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        captureSession?.close()
        cameraDevice?.close()
        imageReader?.close()
        backgroundThread?.quitSafely()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
