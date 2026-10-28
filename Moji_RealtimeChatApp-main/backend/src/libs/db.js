import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const connString = process.env.MONGODB_CONNECTIONSTRING || process.env.MONGO_URI;
    
    if (!connString) {
      throw new Error("Không tìm thấy MONGODB_CONNECTIONSTRING trong file .env!");
    }

    await mongoose.connect(connString);
    console.log("Liên kết CSDL thành công!");
  } catch (error) {
    console.log("Lỗi khi kết nối CSDL:", error.message || error);
    process.exit(1);
  }
};