import cron from "node-cron";
import { Subscription } from "../models/subscription.models.js";
import axios from "axios";

console.log("subscription expiry cron loaded");

const expireSubscriptions = async () => {
  const now = new Date();
  
  try {
    const expiredSubs = await Subscription.find({
      subscription: {
        $elemMatch: {
          endDate: { $lt: now },
          status: "active",
        },
      },
    }).populate('user', 'username email phoneNumber');

    if (expiredSubs.length === 0) {
      console.log("[CRON] No subscriptions to expire");
      return { success: true, expired: 0, emailsSent: 0 };
    }

    console.log(`[CRON] Found ${expiredSubs.length} subscription(s) with expired entries`);

    const result = await Subscription.updateMany(
      {
        subscription: {
          $elemMatch: {
            endDate: { $lt: now },
            status: "active",
          },
        },
      },
      {
        $set: {
          "subscription.$[elem].status": "expired",
        },
      },
      {
        arrayFilters: [
          {
            "elem.endDate": { $lt: now },
            "elem.status": "active",
          },
        ],
      }
    );

    console.log(`[CRON] 💀 Expired ${result.modifiedCount} subscription(s)`);

    let emailsSent = 0;
    let emailsFailed = 0;

    for (const sub of expiredSubs) {
      const user = sub.user;
      if (!user) continue;

      const expiredEntry = sub.subscription.find(
        s => s.endDate < now && s.status === "active"
      );

      if (expiredEntry && user.email) {
        try {
          await axios.post(process.env.N8N_WEBHOOK_URL, {
            eventType: "subscription_expired",
            memberName: user.username,
            email: user.email,
            phoneNumber: user.phoneNumber,
            plan: expiredEntry.plan,
            expiredDate: expiredEntry.endDate.toISOString(),
            expiryNoticeDate: new Date().toISOString()
          });
          emailsSent++;
          console.log(`[CRON] 📧 Expiry email sent to ${user.email}`);
        } catch (error) {
          emailsFailed++;
          console.error(`[CRON] ❌ Failed to send email to ${user.email}:`, error.message);
        }
      }
    }

    const summary = {
      success: true,
      expired: result.modifiedCount,
      emailsSent,
      emailsFailed,
      timestamp: new Date().toISOString()
    };

    console.log(`[CRON] Summary:`, summary);
    return summary;

  } catch (error) {
    console.error("[CRON] ❌ Subscription expiry failed:", error);
    return { 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

export const testSubscriptionExpiry = async () => {
  console.log("\n🧪 [TEST] Running manual subscription expiry test...");
  console.log("🕐 Current time:", new Date().toISOString());
  
  const result = await expireSubscriptions();
  
  console.log("\n🧪 [TEST] Test completed:", result);
  return result;
};

// scheduled for 12:20 dialy night

export const subscriptionExpiryJob = () => {
  cron.schedule("20 0 * * *", async () => {
    console.log("\n[CRON] ⏰ Subscription expiry job started at", new Date().toISOString());
    await expireSubscriptions();
    console.log("[CRON] ✅ Subscription expiry job completed\n");
  });

  console.log("subscription expiry cron scheduled (Daily at 12:20 AM)");
};



// manula test-code

// import cron from "node-cron";
// import { Subscription } from "../models/subscription.models.js";
// import axios from "axios";

// console.log("✅ Subscription expiry cron loaded");

// maunal testing
// export const testSubscriptionExpiry = async () => {
//   console.log("\n🧪 [TEST] Running manual subscription expiry test...");
  
//   try {
//     const now = new Date();
//     console.log("🕐 Current time:", now.toISOString());

//     // Find expired subscriptions
//     const expiredSubs = await Subscription.find({
//       subscription: {
//         $elemMatch: {
//           endDate: { $lt: now },
//           status: "active",
//         },
//       },
//     }).populate('user', 'username email phoneNumber');

//     console.log(`\n📊 Found ${expiredSubs.length} subscription(s) with expired entries`);

//     for (const sub of expiredSubs) {
//       const expiredEntry = sub.subscription.find(
//         s => s.endDate < now && s.status === "active"
//       );
      
//       if (expiredEntry) {
//         console.log(`\n👤 User: ${sub.user?.username}`);
//         console.log(`📅 Plan: ${expiredEntry.plan}`);
//         console.log(`⏰ Expired: ${expiredEntry.endDate}`);
//       }
//     }

//     const result = await Subscription.updateMany(
//       {
//         subscription: {
//           $elemMatch: {
//             endDate: { $lt: now },
//             status: "active",
//           },
//         },
//       },
//       {
//         $set: {
//           "subscription.$[elem].status": "expired",
//         },
//       },
//       {
//         arrayFilters: [
//           {
//             "elem.endDate": { $lt: now },
//             "elem.status": "active",
//           },
//         ],
//       }
//     );

//     console.log(`\n✅ Expired ${result.modifiedCount} subscription(s)!`);

//     // 📧 Send expiry emails
//     for (const sub of expiredSubs) {
//       const user = sub.user;
//       const expiredEntry = sub.subscription.find(
//         s => s.endDate < now && s.status === "active"
//       );

//       if (user && user.email && expiredEntry) {
//         try {
//           await axios.post(process.env.N8N_WEBHOOK_URL, {
//             eventType: "subscription_expired",
//             memberName: user.username,
//             email: user.email,
//             phoneNumber: user.phoneNumber,
//             plan: expiredEntry.plan,
//             expiredDate: expiredEntry.endDate.toISOString(),
//             expiryNoticeDate: new Date().toISOString()
//           });
//           console.log(`📧 Expiry email sent to ${user.email}`);
//         } catch (error) {
//           console.error(`❌ Failed to send email to ${user.email}:`, error.message);
//         }
//       }
//     }

//     return { success: true, expired: result.modifiedCount };

//   } catch (error) {
//     console.error("\n❌ Test failed:", error);
//     return { success: false, error: error.message };
//   }
// };

// export const subscriptionExpiryJob = () => {
//   cron.schedule("20 0 * * *", async () => {
//     console.log("[CRON] Running subscription expiry check...");
//     await testSubscriptionExpiry();
//   });
// };